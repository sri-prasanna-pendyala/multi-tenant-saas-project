import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get("/projects");
        setProjects(res.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  if (loading) return <p>Loading projects...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ padding: "30px" }}>
      <h2>Projects</h2>

      {projects.length === 0 && <p>No projects found</p>}

      <ul>
        {projects.map((project) => (
          <li
            key={project.id}
            style={{
              border: "1px solid #ccc",
              padding: "12px",
              marginBottom: "10px",
              cursor: "pointer",
            }}
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            <strong>{project.name}</strong>
            <br />
            <span>{project.description}</span>
            <br />
            <small>Status: {project.status}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
