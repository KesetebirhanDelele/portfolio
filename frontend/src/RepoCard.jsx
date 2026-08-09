function RepoCard({ repo, isTop }) {
  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        className="repo-card"
        style={{
          padding: "10px",
          border: isTop ? "2px solid gold" : "1px solid #ddd",
          backgroundColor: isTop ? "#fffbea" : undefined,
          borderRadius: "6px",
          marginBottom: "10px",
          textAlign: "left",
          cursor: "pointer"
        }}
      >
        <strong style={{ fontSize: "16px", display: "block", marginBottom: "6px" }}>{repo.name}</strong>
        <p style={{ margin: "0 0 6px", fontSize: "14px", color: "#666" }}>
          {repo.description || "No description available"}
        </p>
        <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#888", marginBottom: "6px" }}>
          <span>Language: {repo.language || "Unknown"}</span>
          <span>Updated: {new Date(repo.updated_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
        </div>
        <span style={{ display: "block", marginTop: "6px" }}>⭐ {repo.stargazers_count}</span>
      </div>
    </a>
  )
}

export default RepoCard
