import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { formatDate, formatDateTime } from "../components/formatters";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastContext";
import {
  CATEGORY_OPTIONS,
  EMPTY_PROJECT_FORM,
  GYR_OPTIONS,
  LEGACY_TYPE_OPTIONS,
  MAJOR_MINOR_OPTIONS,
  getProjectDisplayName,
  toProjectPayload,
  validateProjectForm,
} from "../constants/project";

const MAX_IMAGE_ATTACHMENT_BYTES = 120000;

function normalizeGyrValue(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "GREEN") {
    return "G";
  }
  if (text === "YELLOW") {
    return "Y";
  }
  if (text === "RED") {
    return "R";
  }
  return text;
}

export default function UserDashboard() {
  const { session, logout } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const imageInputRef = useRef(null);

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const [projectCategoryFilter, setProjectCategoryFilter] = useState("");
  const [projectGyrFilter, setProjectGyrFilter] = useState("");

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

  const setProjectField = (field, value) => {
    setProjectForm((prev) => ({ ...prev, [field]: value }));
  };

  const onProjectImageFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setProjectForm((prev) => ({ ...prev, imageDataUrl: "", imageName: "" }));
      return;
    }

    if (!file.type.startsWith("image/")) {
      pushToast("Only image files are allowed.", "error");
      setProjectForm((prev) => ({ ...prev, imageDataUrl: "", imageName: "" }));
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_ATTACHMENT_BYTES) {
      pushToast("Image attachment is too large. Use an image URL for large files.", "error");
      setProjectForm((prev) => ({ ...prev, imageDataUrl: "", imageName: "" }));
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProjectForm((prev) => ({
        ...prev,
        imageDataUrl: String(reader.result || ""),
        imageName: file.name,
      }));
    };
    reader.onerror = () => {
      pushToast("Failed to read image attachment.", "error");
      setProjectForm((prev) => ({ ...prev, imageDataUrl: "", imageName: "" }));
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const submitProject = async (event) => {
    event.preventDefault();

    const validationError = validateProjectForm(projectForm);
    if (validationError) {
      pushToast(validationError, "error");
      return;
    }

    setCreatingProject(true);
    try {
      await apiClient.createProject(session.token, toProjectPayload(projectForm));
      pushToast("Project created.", "success");
      setProjectForm(EMPTY_PROJECT_FORM);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
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

  const filteredProjects = useMemo(() => {
    const normalizedSearch = projectSearchTerm.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          project.projectId,
          project.model,
          project.title,
          project.customer,
          project.category,
          project.platform,
          project.legacyType,
          project.statusLatest,
        ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));

      const matchesCategory =
        !projectCategoryFilter || String(project.category || "").trim().toUpperCase() === projectCategoryFilter;

      const matchesGyr = !projectGyrFilter || normalizeGyrValue(project.gyrStatus) === projectGyrFilter;

      return matchesSearch && matchesCategory && matchesGyr;
    });
  }, [projectCategoryFilter, projectGyrFilter, projectSearchTerm, projects]);

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

      <div className="card">
        <div className="section-row">
          <h2 className="subsection-title">Create My Project</h2>
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowCreateProjectForm((prev) => !prev)}
          >
            {showCreateProjectForm ? "Hide Create Project" : "Create New Project"}
          </button>
        </div>

        {showCreateProjectForm ? (
          <form className="form" onSubmit={submitProject}>
            <div className="form-grid form-grid--two">
              <label className="form-label">
                Legacy/Key less
                <select
                  className="input"
                  value={projectForm.legacyType}
                  onChange={(event) => setProjectField("legacyType", event.target.value)}
                >
                  <option value="">Select type</option>
                  {LEGACY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Customer
                <input
                  className="input"
                  value={projectForm.customer}
                  onChange={(event) => setProjectField("customer", event.target.value)}
                  placeholder="Customer name"
                />
              </label>

              <label className="form-label">
                Model
                <input
                  className="input"
                  value={projectForm.model}
                  onChange={(event) => setProjectField("model", event.target.value)}
                  placeholder="Model name"
                />
              </label>

              <label className="form-label">
                Category (A/B/C)
                <select
                  className="input"
                  value={projectForm.category}
                  onChange={(event) => setProjectField("category", event.target.value)}
                >
                  <option value="">Select category</option>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Major/Minor
                <select
                  className="input"
                  value={projectForm.majorMinor}
                  onChange={(event) => setProjectField("majorMinor", event.target.value)}
                >
                  <option value="">Select type</option>
                  {MAJOR_MINOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Effort Days
                <input
                  className="input"
                  value={projectForm.effortDays}
                  onChange={(event) => setProjectField("effortDays", event.target.value)}
                  placeholder="e.g. 16"
                />
              </label>

              <label className="form-label">
                Platform
                <input
                  className="input"
                  value={projectForm.platform}
                  onChange={(event) => setProjectField("platform", event.target.value)}
                  placeholder="e.g. EV"
                />
              </label>

              <label className="form-label">
                SOP Date
                <input
                  type="date"
                  className="input"
                  value={projectForm.sopDate}
                  onChange={(event) => setProjectField("sopDate", event.target.value)}
                />
              </label>

              <label className="form-label">
                Volume (Lacs)
                <input
                  className="input"
                  value={projectForm.volumeLacs}
                  onChange={(event) => setProjectField("volumeLacs", event.target.value)}
                  placeholder="e.g. 0.80"
                />
              </label>

              <label className="form-label">
                Business Potential / Annum (Lacs)
                <input
                  className="input"
                  value={projectForm.businessPotentialLacs}
                  onChange={(event) => setProjectField("businessPotentialLacs", event.target.value)}
                  placeholder="e.g. 1280"
                />
              </label>

              <label className="form-label">
                GYR
                <select
                  className="input"
                  value={projectForm.gyrStatus}
                  onChange={(event) => setProjectField("gyrStatus", event.target.value)}
                >
                  <option value="">Select status</option>
                  {GYR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                Image URL
                <input
                  className="input"
                  value={projectForm.imageUrl}
                  onChange={(event) => setProjectField("imageUrl", event.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </label>
            </div>

            <label className="form-label">
              Product Description
              <textarea
                className="input textarea"
                rows={4}
                value={projectForm.productDescription}
                onChange={(event) => setProjectField("productDescription", event.target.value)}
                placeholder="Detailed product description"
              />
            </label>

            <label className="form-label">
              Image Attachment (Optional)
              <input
                ref={imageInputRef}
                type="file"
                className="input file-input"
                accept="image/*"
                onChange={onProjectImageFileChange}
              />
              <span className="input-hint">
                Small image only. For large images, use Image URL (JSONP request size limitation).
              </span>
            </label>

            <button className="primary-button" type="submit" disabled={creatingProject}>
              {creatingProject ? <Spinner /> : "Create Project"}
            </button>
          </form>
        ) : (
          <p className="muted">Click Create New Project to open the project form.</p>
        )}
      </div>

      <div className="card">
        <div className="section-row">
          <h2 className="subsection-title">My Projects</h2>
          <button type="button" className="secondary-button" onClick={loadProjects} disabled={loadingProjects}>
            {loadingProjects ? <Spinner /> : "Refresh"}
          </button>
        </div>

        <div className="table-filters">
          <input
            className="input"
            value={projectSearchTerm}
            onChange={(event) => setProjectSearchTerm(event.target.value)}
            placeholder="Search by project, model, customer, status"
          />
          <select
            className="input"
            value={projectCategoryFilter}
            onChange={(event) => setProjectCategoryFilter(event.target.value)}
          >
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select className="input" value={projectGyrFilter} onChange={(event) => setProjectGyrFilter(event.target.value)}>
            <option value="">All GYR</option>
            {GYR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Model</th>
                <th>Customer</th>
                <th>Category</th>
                <th>GYR</th>
                <th>SOP</th>
                <th>Latest Update</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    {projects.length === 0 ? "No projects assigned yet." : "No projects match current filters."}
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  <tr key={project.projectId}>
                    <td>{project.projectId || "-"}</td>
                    <td>{project.model || project.title || "-"}</td>
                    <td>{project.customer || "-"}</td>
                    <td>{project.category || "-"}</td>
                    <td>{normalizeGyrValue(project.gyrStatus) || "-"}</td>
                    <td>{formatDate(project.sopDate || project.deadline)}</td>
                    <td>{project.statusLatest || "No updates yet"}</td>
                    <td>
                      <div className="button-row">
                        <button type="button" className="primary-button" onClick={() => openAddUpdate(project)}>
                          Add Update
                        </button>
                        <button type="button" className="secondary-button" onClick={() => openViewUpdates(project)}>
                          View Updates
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        title={selectedProject ? `Add Update - ${getProjectDisplayName(selectedProject)}` : "Add Update"}
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
                      {update.assigneeUsername} | {formatDateTime(update.createdAt)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </Modal>

      <Modal
        title={selectedProject ? `Updates - ${getProjectDisplayName(selectedProject)}` : "Project Updates"}
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
                    {update.assigneeUsername} | {formatDateTime(update.createdAt)}
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
