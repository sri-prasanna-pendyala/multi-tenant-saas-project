import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div style={{ padding: 40 }}>
      <h2>Dashboard</h2>

      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Role:</strong> {user.role}</p>

      {user.tenant && (
        <>
          <p><strong>Tenant:</strong> {user.tenant.name}</p>
          <p><strong>Plan:</strong> {user.tenant.subscriptionPlan}</p>
          <hr />
<a href="/projects">View Projects</a>

        </>
      )}
    </div>
  );
}
