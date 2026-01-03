import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/api";

export default function ProjectDetails() {
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
 const token = localStorage.getItem("token");
const userRole = token
  ? JSON.parse(atob(token.split(".")[1])).role
  : null;
console.log("USER ROLE:", userRole);



  const fetchData = async () => {
    try {
      const projectRes = await api.get(`/projects/${projectId}`);
      setProject(projectRes.data.data);

      const tasksRes = await api.get(`/projects/${projectId}/tasks`);
      setTasks(tasksRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
     const res = await api.post(`/projects/${projectId}/tasks`, {
  title: title.trim(),
  priority,
});

setTasks((prev) => [...prev, res.data.data]);

setTitle("");
setPriority("medium");
 // refresh list
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create task");
    }
  };

  if (loading) return <p>Loading project...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!project) return <p>Project not found</p>;

  return (
    <div style={{ padding: "30px" }}>
      <h2>{project.name}</h2>
      <p>{project.description}</p>
      <p>
        <strong>Status:</strong> {project.status}
      </p>

      <hr />

      <h3>Create Task</h3>

      <form onSubmit={handleCreateTask}>
        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          style={{ marginLeft: "10px" }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button type="submit" disabled={!title.trim()}>
  Add
</button>

      </form>

      <hr />

      <h3>Tasks</h3>

{tasks.length === 0 && <p>No tasks found</p>}

<ul>
  {tasks.map((task) => (
    <li key={task.id} style={{ marginBottom: "12px", borderBottom: "1px solid #ddd" }}>

      <div>
        <strong>{task.title}</strong>
      </div>

      <div>
        Status:
        <select
          value={task.status}
          style={{ marginLeft: "8px" }}
          onChange={async (e) => {
            const newStatus = e.target.value;

            await api.patch(`/tasks/${task.id}/status`, {
              status: newStatus,
            });

            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id ? { ...t, status: newStatus } : t
              )
            );
          }}
        >
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <small>Priority: {task.priority}</small>
      {userRole === "tenant_admin" && (
  <button
    style={{ color: "red", marginTop: "5px" }}
    onClick={async () => {
      if (!window.confirm("Delete this task?")) return;

      try {
        await api.delete(`/tasks/${task.id}`);
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } catch (err) {
        alert("Failed to delete task");
      }
    }}
  >
    Delete
  </button>
)}

    </li>
  ))}
</ul>


    </div>
  );
}
