import React from "react";

interface Props {
  children: React.ReactNode;
  variant?: "judge" | "overlay";
}
interface State { error: Error | null; }

/** Top-level error boundary for judge + overlay apps. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Recoverable from an OBS console.
    console.error("[ErrorBoundary]", error, errorInfo.componentStack);
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.variant === "overlay") {
      // Transparent + tiny badge to avoid obstructing the stream.
      return (
        <div style={{position:"fixed",top:8,left:8,padding:"4px 8px",background:"rgba(0,0,0,0.6)",color:"#fff",fontSize:11,borderRadius:4,fontFamily:"sans-serif"}}>
          overlay error — refresh OBS source
        </div>
      );
    }

    return (
      <div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text-primary)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Outfit',sans-serif"}}>
        <div style={{maxWidth:420,width:"100%",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:24}}>
          <h1 style={{fontSize:20,fontWeight:800,marginBottom:8,color:"var(--text-primary)"}}>Something went wrong</h1>
          <p style={{fontSize:13,color:"var(--text-muted)",marginBottom:16,lineHeight:1.5}}>Your match data is safely stored. Refresh this page to resume.</p>
          <button onClick={()=>location.reload()} style={{padding:"10px 16px",borderRadius:8,border:"none",background:"#7C3AED",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>Refresh</button>
          <details style={{marginTop:16,fontSize:12,color:"var(--text-muted)"}}>
            <summary style={{cursor:"pointer"}}>Show error details</summary>
            <pre style={{marginTop:8,padding:10,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:6,fontSize:11,whiteSpace:"pre-wrap",wordBreak:"break-word",color:"var(--text-muted)"}}>{error.message}{"\n\n"}{error.stack}</pre>
          </details>
        </div>
      </div>
    );
  }
}
