function ProfileCard({ userData }) {
  return (
    <div style={{
      border: "1px solid #ddd",
      borderRadius: "10px",
      padding: "20px",
      marginTop: "20px",
      width: "300px",
      textAlign: "center"
    }}>
      <img src={userData.avatar_url} width="100" />
      <h3>{userData.login}</h3>
      <p>{userData.bio || "No bio available"}</p>
      <p>Followers: {userData.followers}</p>
      <p>Following: {userData.following}</p>
      <p>Location: {userData.location || "Not specified"}</p>
      <p>Company: {userData.company || "Not specified"}</p>
      <p>Public Repos: {userData.public_repos}</p>
      <a
        href={userData.html_url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <button
          style={{ marginTop: "10px", padding: "10px 20px", backgroundColor: "#4f46e5", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
          onMouseEnter={(e) => e.target.style.backgroundColor = "#4338ca"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "#4f46e5"}
        >
          View GitHub Profile
        </button>
      </a>
    </div>
  )
}

export default ProfileCard
