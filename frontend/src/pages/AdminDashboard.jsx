import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { formatDate, formatDateTime } from "../components/formatters";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastContext";

const EMPTY_USER_FORM = {
  username: "",
  password: "",
  active: true,
};

const EMPTY_PROJECT_FORM = {
  title: "",
  description: "",
  deadline: "",
  assigneeUserId: "",
};

export default function AdminDashboard() {
  const { session, logout } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("users");

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);

  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [adminRemark, setAdminRemark] = useState("");
  const [addingAdminUpdate, setAddingAdminUpdate] = useState(false);

  const activeUsers = useMemo(
    () => users.filter((user) => user.active === true || String(user.active).toUpperCase() === "TRUE"),
    [users]
  );

  const onUnauthorized = useCallback(() => {
    pushToast("Session expired. Please log in again.", "error");
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate, pushToast]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const response = await apiClient.listUsers(session.token);
      setUsers(response.users || []);
    } catch (error) {
      if (error.message.toLowerCase().includes("unauthorized")) {
        onUnauthorized();
        return;
      }
      pushToast(error.message, "error");
    } finally {
      setLoadingUsers(false);
    }
  }, [onUnauthorized, pushToast, session.token]);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const response = await apiClient.getAllProjects(session.token);
      setProjects(response.projects || []);
    } catch (error) {
      if (error.message.toLowerCase().includes("unauthorized")) {
        onUnauthorized();
        return;
      }
      pushToast(error.message, "error");
    } finally {
      setLoadingProjects(false);
    }
  }, [onUnauthorized, pushToast, session.token]);

  useEffect(() => {
    Promise.all([loadUsers(), loadProjects()]);
  }, [loadProjects, loadUsers]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const submitUser = async (event) => {
    event.preventDefault();

    if (!userForm.username.trim() || !userForm.password) {
      pushToast("Username and password are required.", "error");
      return;
    }

    setCreatingUser(true);
    try {
      await apiClient.createUser(session.token, {
        username: userForm.username.trim(),
        password: userForm.password,
        active: userForm.active,
      });
      pushToast("User created.", "success");
      setUserForm(EMPTY_USER_FORM);
      await loadUsers();
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setCreatingUser(false);
    }
  };

  const submitProject = async (event) => {
    event.preventDefault();

    if (!projectForm.title.trim() || !projectForm.description.trim() || !projectForm.assigneeUserId) {
      pushToast("Title, description, and assignee are required.", "error");
      return;
    }

    setCreatingProject(true);
    try {
      await apiClient.createProject(session.token, {
        title: projectForm.title.trim(),
        description: projectForm.description.trim(),
        deadline: projectForm.deadline || "",
        assigneeUserId: projectForm.assigneeUserId,
      });
      pushToast("Project created.", "success");
      setProjectForm(EMPTY_PROJECT_FORM);
      await loadProjects();
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setCreatingProject(false);
    }
  };

  const openUpdates = async (project) => {
    setSelectedProject(project);
    setAdminRemark("");
    setUpdatesOpen(true);
    setUpdatesLoading(true);
    try {
      const response = await apiClient.getProjectUpdates(session.token, project.projectId);
      setUpdates(response.updates || []);
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setUpdatesLoading(false);
    }
  };

  const submitAdminUpdate = async (event) => {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    if (!adminRemark.trim()) {
      pushToast("Remark is required.", "error");
      return;
    }

    setAddingAdminUpdate(true);
    try {
      const response = await apiClient.addProjectUpdate(session.token, selectedProject.projectId, adminRemark.trim());
      setUpdates(response.updates || []);
      setProjects((prev) =>
        prev.map((project) =>
          project.projectId === selectedProject.projectId
            ? {
                ...project,
                statusLatest: adminRemark.trim(),
              }
            : project
        )
      );
      setAdminRemark("");
      pushToast("Update added.", "success");
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setAddingAdminUpdate(false);
    }
  };

  return (
    <section className="page">
      <div className="dashboard-header card">
        <div>
          <h1 className="section-title">Admin Dashboard</h1>
          <p className="muted">Signed in as {session.username}</p>
        </div>
        <button type="button" className="secondary-button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="tab-bar">
        <button
          type="button"
          className={`tab-button ${activeTab === "users" ? "tab-button--active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Users
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "projects" ? "tab-button--active" : ""}`}
          onClick={() => setActiveTab("projects")}
        >
          Projects
        </button>
      </div>

      {activeTab === "users" ? (
        <div className="grid two-col">
          <div className="card">
            <h2 className="subsection-title">Create User</h2>
            <form className="form" onSubmit={submitUser}>
              <label className="form-label">
                Username
                <input
                  className="input"
                  value={userForm.username}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="Username"
                />
              </label>

              <label className="form-label">
                Password
                <input
                  type="password"
                  className="input"
                  value={userForm.password}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Temporary password"
                />
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(userForm.active)}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, active: event.target.checked }))}
                />
                Active user
              </label>

              <button className="primary-button" type="submit" disabled={creatingUser}>
                {creatingUser ? <Spinner /> : "Create User"}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="section-row">
              <h2 className="subsection-title">All Users</h2>
              <button type="button" className="secondary-button" onClick={loadUsers} disabled={loadingUsers}>
                {loadingUsers ? <Spinner /> : "Refresh"}
              </button>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Active</th>
                    <th>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty-cell">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.userId}>
                        <td>{user.username}</td>
                        <td>{String(user.active).toUpperCase() === "TRUE" || user.active === true ? "Yes" : "No"}</td>
                        <td>{formatDateTime(user.lastLoginAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid two-col">
          <div className="card">
            <h2 className="subsection-title">Create Project</h2>
            <form className="form" onSubmit={submitProject}>
              <label className="form-label">
                Title
                <input
                  className="input"
                  value={projectForm.title}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Project title"
                />
              </label>

              <label className="form-label">
                Description
                <textarea
                  className="input textarea"
                  value={projectForm.description}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Project summary"
                  rows={5}
                />
              </label>

              <label className="form-label">
                Deadline (Optional)
                <input
                  type="date"
                  className="input"
                  value={projectForm.deadline}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, deadline: event.target.value }))}
                />
              </label>

              <label className="form-label">
                Assignee
                <select
                  className="input"
                  value={projectForm.assigneeUserId}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, assigneeUserId: event.target.value }))}
                >
                  <option value="">Select active user</option>
                  {activeUsers.map((user) => (
                    <option key={user.userId} value={user.userId}>
                      {user.username} ({user.userId})
                    </option>
                  ))}
                </select>
              </label>

              <button className="primary-button" type="submit" disabled={creatingProject}>
                {creatingProject ? <Spinner /> : "Create Project"}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="section-row">
              <h2 className="subsection-title">Projects</h2>
              <button type="button" className="secondary-button" onClick={loadProjects} disabled={loadingProjects}>
                {loadingProjects ? <Spinner /> : "Refresh"}
              </button>
            </div>

            <div className="project-list">
              {projects.length === 0 ? (
                <p className="muted">No projects available.</p>
              ) : (
                projects.map((project) => (
                  <article key={project.projectId} className="project-card">
                    <div className="project-card__head">
                      <h3>{project.title}</h3>
                      <span className="pill">{project.projectId}</span>
                    </div>
                    <p className="muted">Assignee: {project.assigneeUsername || "-"}</p>
                    <p className="muted">Deadline: {formatDate(project.deadline)}</p>
                    <p className="muted">Created: {formatDateTime(project.createdAt)}</p>
                    <p className="status-text">Latest: {project.statusLatest || "No updates yet"}</p>
                    <button type="button" className="secondary-button" onClick={() => openUpdates(project)}>
                      View Updates
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        title={selectedProject ? `Project Updates - ${selectedProject.title}` : "Project Updates"}
        open={updatesOpen}
        onClose={() => setUpdatesOpen(false)}
      >
        {updatesLoading ? (
          <div className="centered">
            <Spinner size="large" />
          </div>
        ) : (
          <>
            <form className="form" onSubmit={submitAdminUpdate}>
              <label className="form-label">
                Add Update
                <textarea
                  className="input textarea"
                  rows={3}
                  value={adminRemark}
                  onChange={(event) => setAdminRemark(event.target.value)}
                  placeholder="Enter project remark"
                />
              </label>
              <button type="submit" className="primary-button" disabled={addingAdminUpdate}>
                {addingAdminUpdate ? <Spinner /> : "Submit Update"}
              </button>
            </form>

            <div className="updates-list">
              {updates.length === 0 ? (
                <p className="muted">No updates for this project.</p>
              ) : (
                updates.map((update) => (
                  <article key={update.updateId} className="update-card">
                    <p>{update.remark}</p>
                    <p className="muted">
                      {update.assigneeUsername} · {formatDateTime(update.createdAt)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}


