import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Github, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import io from "socket.io-client"; // Import socket.io-client

export default function Home() {
  const [repoURL, setURL] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState(null);
  const [deployPreviewURL, setDeployPreviewURL] = useState(null);
  const [buildDir, setBuildDir] = useState("build"); // Set default value
  const [error, setError] = useState(null);
  
  const logContainerRef = useRef(null);
  const socket = useRef(null); // Use useRef to persist socket instance across renders

  // Simple URL validation
  const isValidURL = () => {
    if (!repoURL) return false;
    const urlRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/;
    return urlRegex.test(repoURL);
  };

  const handleClickDeploy = async () => {
    if (!isValidURL()) {
      setError("Please enter a valid GitHub URL");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("http://localhost:9000/project", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gitURL: repoURL,
          buildDirectory: buildDir
        }),
      });

      const data = await response.json();

      // if 404 or 500 status code show proper error message
      if (response.status === 404 || response.status === 500 ) {
        setLoading(false);
        throw new Error(data.message || "Deployment failed");
      }
      
      if (!response.ok) {
        throw new Error(data.message || "Deployment failed");
      }

      if (data.data) {
        const { projectSlug, url } = data.data;
        setProjectId(projectSlug);
        setDeployPreviewURL(url); // Set the preview URL on success

        if (socket.current) {
          socket.current.emit("subscribe", `logs:${projectSlug}`);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to deploy project");
    } finally {
      // Set loading to false only when response is processed
    }
  };

  const handleSocketIncomingMessage = useCallback((message) => {
    console.log(`[Incoming Socket Message]:`, typeof message, message);
    const { log } = JSON.parse(message); // Ensure the message is parsed correctly
    setLogs((prevLogs) => [...prevLogs, log]);
    logContainerRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    // Initialize socket connection
    socket.current = io("http://localhost:9002");

    socket.current.on("message", handleSocketIncomingMessage);

    return () => {
      socket.current.off("message", handleSocketIncomingMessage);
    };
  }, [handleSocketIncomingMessage]);

  return (
    <main className="flex justify-center items-center min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Github className="h-8 w-8" />
              Desi Netlify
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Deploy your project from GitHub
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Repository URL</label>
              <Input
                disabled={loading}
                value={repoURL}
                onChange={(e) => setURL(e.target.value)}
                type="url"
                placeholder="https://github.com/username/repository"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Build Directory</label>
              <Select 
                value={buildDir} 
                onValueChange={setBuildDir} 
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select build directory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="build">build</SelectItem>
                  <SelectItem value="dist">dist</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleClickDeploy}
              disabled={loading || !isValidURL()}
              className="w-full"
            >
              {loading && !logs.length ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deploying...
                </span>
              ) : (
                "Deploy Project"
              )}
            </Button>

            {logs.length > 0 && deployPreviewURL && (
              <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Preview URL</span>
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 font-medium"
                    href={deployPreviewURL}
                  >
                    {deployPreviewURL}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

            {loading && !logs.length ? (
              <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Deploying...</span>
                </div>
              </div>
            ) : logs.length > 0 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Deployment Logs</label>
                <div className="bg-slate-950 rounded-lg p-4 h-[300px] overflow-y-auto font-mono">
                  <pre className="flex flex-col gap-1 text-xs text-green-400">
                    {logs.map((log, i) => (
                      <code
                        ref={logs.length - 1 === i ? logContainerRef : undefined}
                        key={i}
                        className="leading-relaxed"
                      >{`> ${log}`}</code>
                    ))}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Deployment Logs</span>
                  <span className="text-xs text-green-500 font-medium">No logs available</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
