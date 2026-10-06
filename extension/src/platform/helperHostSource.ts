/**
 * Static data: the Windows native-messaging helper (C#, compiled on the user's PC with the
 * csc.exe that ships with Windows - no Node or admin rights). Kept ASCII-only, C# 5 syntax.
 * Protocol matches extension/host/hostCore.mjs (the Node host used on macOS/Linux).
 */
export const CSHARP_HOST = String.raw`using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

public static class SyncMarkHost
{
    static string root = "";
    static Stream input;
    static Stream output;
    static readonly object gate = new object();
    static readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
    const int Chunk = 262144;

    public static int Main(string[] args)
    {
        try
        {
            string rootFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "root.txt");
            if (File.Exists(rootFile)) root = Path.GetFullPath(File.ReadAllText(rootFile).Trim());
        }
        catch { root = ""; }
        input = Console.OpenStandardInput();
        output = Console.OpenStandardOutput();
        FileSystemWatcher watcher = null;
        while (true)
        {
            byte[] head = ReadExactly(4);
            if (head == null) return 0;
            byte[] body = ReadExactly(BitConverter.ToInt32(head, 0));
            if (body == null) return 0;
            Dictionary<string, object> req;
            try { req = json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(body)); }
            catch { continue; }
            object id = null;
            req.TryGetValue("id", out id);
            Dictionary<string, object> res;
            try
            {
                string cmd = Text(req, "cmd");
                if (root.Length == 0) throw new Exception("no folder configured; run SyncMark setup again");
                if (cmd == "watch")
                {
                    if (watcher == null) watcher = StartWatch();
                    res = Ok();
                }
                else res = Handle(cmd, req);
            }
            catch (Exception ex)
            {
                res = new Dictionary<string, object>();
                res["ok"] = false;
                res["error"] = ex.Message;
            }
            res["id"] = id;
            Send(res);
        }
    }

    static Dictionary<string, object> Ok()
    {
        Dictionary<string, object> d = new Dictionary<string, object>();
        d["ok"] = true;
        return d;
    }

    static string Text(Dictionary<string, object> req, string key)
    {
        object v;
        return req.TryGetValue(key, out v) && v != null ? v.ToString() : "";
    }

    static string Resolve(string rel)
    {
        string full = Path.GetFullPath(Path.Combine(root, rel.TrimStart('/', '\\')));
        string sep = Path.DirectorySeparatorChar.ToString();
        string baseDir = root.TrimEnd('\\') ;
        if (full != baseDir && !full.StartsWith(baseDir + sep, StringComparison.OrdinalIgnoreCase))
            throw new Exception("path escapes root");
        return full;
    }

    static Dictionary<string, object> Handle(string cmd, Dictionary<string, object> req)
    {
        Dictionary<string, object> res = Ok();
        if (cmd == "ping")
        {
            res["root"] = root;
            res["version"] = 1;
        }
        else if (cmd == "read")
        {
            string full = Resolve(Text(req, "path"));
            long offset = req.ContainsKey("offset") ? Convert.ToInt64(req["offset"]) : 0;
            if (!File.Exists(full))
            {
                res["exists"] = false; res["size"] = 0; res["data"] = ""; res["eof"] = true;
                return res;
            }
            using (FileStream fs = new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                long size = fs.Length;
                int want = (int)Math.Max(0, Math.Min((long)Chunk, size - offset));
                byte[] buf = new byte[want];
                fs.Seek(offset, SeekOrigin.Begin);
                int got = 0;
                while (got < want)
                {
                    int n = fs.Read(buf, got, want - got);
                    if (n <= 0) break;
                    got += n;
                }
                if (got < want) Array.Resize(ref buf, got);
                res["exists"] = true;
                res["size"] = size;
                res["data"] = Convert.ToBase64String(buf);
                res["eof"] = offset + got >= size;
            }
        }
        else if (cmd == "write")
        {
            string full = Resolve(Text(req, "path"));
            Directory.CreateDirectory(Path.GetDirectoryName(full));
            string tmp = Path.Combine(Path.GetDirectoryName(full), "." + Guid.NewGuid().ToString("N") + ".tmp");
            File.WriteAllText(tmp, Text(req, "content"), new UTF8Encoding(false));
            for (int i = 0; ; i++)
            {
                try
                {
                    if (File.Exists(full)) File.Replace(tmp, full, null);
                    else File.Move(tmp, full);
                    break;
                }
                catch (Exception)
                {
                    if (i >= 5) { try { File.Delete(tmp); } catch (Exception) { } throw; }
                    Thread.Sleep(40 * (i + 1));
                }
            }
        }
        else if (cmd == "list")
        {
            string dir = Resolve(Text(req, "prefix"));
            List<string> files = new List<string>();
            if (Directory.Exists(dir))
            {
                foreach (string f in Directory.GetFiles(dir, "*", SearchOption.AllDirectories))
                {
                    string rel = Relative(f);
                    if (!Hidden(rel)) files.Add(rel);
                }
            }
            res["files"] = files;
        }
        else
        {
            res["ok"] = false;
            res["error"] = "unknown cmd " + cmd;
        }
        return res;
    }

    static string Relative(string full)
    {
        return full.Substring(root.TrimEnd('\\').Length).TrimStart('\\').Replace('\\', '/');
    }

    static bool Hidden(string rel)
    {
        if (rel.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)) return true;
        foreach (string part in rel.Split('/')) if (part.StartsWith(".")) return true;
        return false;
    }

    static FileSystemWatcher StartWatch()
    {
        FileSystemWatcher w = new FileSystemWatcher(root);
        w.IncludeSubdirectories = true;
        w.NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size;
        FileSystemEventHandler onChange = delegate (object s, FileSystemEventArgs e)
        {
            string rel = Relative(e.FullPath);
            if (Hidden(rel)) return;
            Dictionary<string, object> m = new Dictionary<string, object>();
            m["event"] = "changed";
            m["path"] = rel;
            Send(m);
        };
        w.Changed += onChange;
        w.Created += onChange;
        w.Renamed += delegate (object s, RenamedEventArgs e) { onChange(s, e); };
        w.EnableRaisingEvents = true;
        return w;
    }

    static byte[] ReadExactly(int count)
    {
        byte[] buf = new byte[count];
        int got = 0;
        while (got < count)
        {
            int n = input.Read(buf, got, count - got);
            if (n <= 0) return null;
            got += n;
        }
        return buf;
    }

    static void Send(Dictionary<string, object> msg)
    {
        byte[] body = Encoding.UTF8.GetBytes(json.Serialize(msg));
        lock (gate)
        {
            output.Write(BitConverter.GetBytes(body.Length), 0, 4);
            output.Write(body, 0, body.Length);
            output.Flush();
        }
    }
}
`;
