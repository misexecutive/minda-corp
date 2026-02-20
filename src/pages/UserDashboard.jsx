import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { formatDate, formatDateTime } from "../components/formatters";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastContext";

const EMPTY_PROJECT_FORM = {
  title: "",
  description: "",
  deadline: "",
};

export default function UserDashboard() {
  const { session, logout } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [remark, setRemark] = useState("");
  const [submittingRemark, setSubmittingRemark] = useState(false);

  const onUnauthorized = useCallback(() => {
    pushToast("Session expired. Please log in again.", "error");
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate, pushToast]);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const response = await apiClient.getMyProjects(session.token);
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
    loadProjects();
  }, [loadProjects]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const submitProject = async (event) => {
    event.preventDefault();

    if (!projectForm.title.trim() || !projectForm.description.trim()) {
      pushToast("Title and description are required.", "error");
      return;
    }

    setCreatingProject(true);
    try {
      await apiClient.createProject(session.token, {
        title: projectForm.title.trim(),
        description: projectForm.description.trim(),
        deadline: projectForm.deadline || "",
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

  const fetchUpdates = async (project) => {
    setSelectedProject(project);
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

  const openAddUpdate = async (project) => {
    setRemark("");
    setAddModalOpen(true);
    await fetchUpdates(project);
  };

  const openViewUpdates = async (project) => {
    setViewModalOpen(true);
    await fetchUpdates(project);
  };

  const submitUpdate = async (event) => {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    if (!remark.trim()) {
      pushToast("Remark is required.", "error");
      return;
    }

    setSubmittingRemark(true);
    try {
      const response = await apiClient.addProjectUpdate(session.token, selectedProject.projectId, remark.trim());
      setUpdates(response.updates || []);
      setProjects((prev) =>
        prev.map((project) =>
          project.projectId === selectedProject.projectId
            ? {
                ...project,
                statusLatest: remark.trim(),
              }
            : project
        )
      );
      setRemark("");
      pushToast("Update submitted.", "success");
    } catch (error) {
      pushToast(error.message, "error");
    } finally {
      setSubmittingRemark(false);
    }
  };

  return (
    <section className="page">
      <div className="dashboard-header card">
        <div>
          <h1 className="section-title">Project Manager Dashboard</h1>
          <p className="muted">Signed in as {session.username}</p>
        </div>
        <button type="button" className="secondary-button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="grid two-col">
        <div className="card">
          <h2 className="subsection-title">Create My Project</h2>
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
                rows={5}
                value={projectForm.description}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Project details"
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

            <button className="primary-button" type="submit" disabled={creatingProject}>
              {creatingProject ? <Spinner /> : "Create Project"}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="section-row">
            <h2 className="subsection-title">My Projects</h2>
            <button type="button" className="secondary-button" onClick={loadProjects} disabled={loadingProjects}>
              {loadingProjects ? <Spinner /> : "Refresh"}
            </button>
          </div>

          <div className="project-list">
            {projects.length === 0 ? (
              <p className="muted">No projects assigned yet.</p>
            ) : (
              projects.map((project) => (
                <article key={project.projectId} className="project-card">
                  <div className="project-card__head">
                    <h3>{project.title}</h3>
                    <span className="pill">{project.projectId}</span>
                  </div>
                  <p className="muted">Deadline: {formatDate(project.deadline)}</p>
                  <p className="muted">Created: {formatDateTime(project.createdAt)}</p>
                  <p className="status-text">Latest: {project.statusLatest || "No updates yet"}</p>
                  <div className="button-row">
                    <button type="button" className="primary-button" onClick={() => openAddUpdate(project)}>
                      Add Update
                    </button>
                    <button type="button" className="secondary-button" onClick={() => openViewUpdates(project)}>
                      View Updates
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal
        title={selectedProject ? `Add Update - ${selectedProject.title}` : "Add Update"}
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      >
        {updatesLoading ? (
          <div className="centered">
            <Spinner size="large" />
          </div>
        ) : (
          <>
            <form className="form" onSubmit={submitUpdate}>
              <label className="form-label">
                Remark
                <textarea
                  className="input textarea"
                  rows={4}
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  placeholder="Write progress update"
                />
              </label>

              <button type="submit" className="primary-button" disabled={submittingRemark}>
                {submittingRemark ? <Spinner /> : "Submit"}
              </button>
            </form>

            <div className="updates-list">
              {updates.length === 0 ? (
                <p className="muted">No updates yet.</p>
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

      <Modal
        title={selectedProject ? `Updates - ${selectedProject.title}` : "Project Updates"}
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
      >
        {updatesLoading ? (
          <div className="centered">
            <Spinner size="large" />
          </div>
        ) : (
          <div className="updates-list">
            {updates.length === 0 ? (
              <p className="muted">No updates yet.</p>
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
        )}
      </Modal>
    </section>
  );
}


