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

const EMPTY_USER_FORM = {
  username: "",
  password: "",
  active: true,
};

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

export default function AdminDashboard() {
  const { session, logout } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const imageInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("users");

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT_FORM);

  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const [projectAssigneeFilter, setProjectAssigneeFilter] = useState("");
  const [projectCategoryFilter, setProjectCategoryFilter] = useState("");
  const [projectGyrFilter, setProjectGyrFilter] = useState("");

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

  const assigneeFilterOptions = useMemo(() => {
    const optionMap = new Map();
    projects.forEach((project) => {
      const value = String(project.assigneeUserId || project.assigneeUsername || "").trim();
      const label = String(project.assigneeUsername || project.assigneeUserId || "").trim();
      if (value) {
        optionMap.set(value, label || value);
      }
    });

    return Array.from(optionMap.entries()).map(([value, label]) => ({ value, label }));
  }, [projects]);

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

    const validationError = validateProjectForm(projectForm, { requireTeamLead: true });
    if (validationError) {
      pushToast(validationError, "error");
      return;
    }

    setCreatingProject(true);
    try {
      await apiClient.createProject(session.token, toProjectPayload(projectForm, { includeAssignee: true }));
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
          project.assigneeUsername,
          project.legacyType,
          project.statusLatest,
        ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));

      const assigneeValue = String(project.assigneeUserId || project.assigneeUsername || "").trim();
      const matchesAssignee = !projectAssigneeFilter || assigneeValue === projectAssigneeFilter;

      const matchesCategory =
        !projectCategoryFilter || String(project.category || "").trim().toUpperCase() === projectCategoryFilter;

      const matchesGyr = !projectGyrFilter || normalizeGyrValue(project.gyrStatus) === projectGyrFilter;

      return matchesSearch && matchesAssignee && matchesCategory && matchesGyr;
    });
  }, [projectAssigneeFilter, projectCategoryFilter, projectGyrFilter, projectSearchTerm, projects]);

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
        <div className="grid">
          <div className="card">
            <div className="section-row">
              <h2 className="subsection-title">Create Project</h2>
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
                    Team Lead
                    <select
                      className="input"
                      value={projectForm.assigneeUserId}
                      onChange={(event) => setProjectField("assigneeUserId", event.target.value)}
                    >
                      <option value="">Select active user</option>
                      {activeUsers.map((user) => (
                        <option key={user.userId} value={user.userId}>
                          {user.username} ({user.userId})
                        </option>
                      ))}
                    </select>
                  </label>

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
                    value={projectForm.productDescription}
                    onChange={(event) => setProjectField("productDescription", event.target.value)}
                    placeholder="Detailed product description"
                    rows={4}
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
              <h2 className="subsection-title">Projects</h2>
              <button type="button" className="secondary-button" onClick={loadProjects} disabled={loadingProjects}>
                {loadingProjects ? <Spinner /> : "Refresh"}
              </button>
            </div>

            <div className="table-filters table-filters--wide">
              <input
                className="input"
                value={projectSearchTerm}
                onChange={(event) => setProjectSearchTerm(event.target.value)}
                placeholder="Search by project, model, customer, team lead"
              />
              <select
                className="input"
                value={projectAssigneeFilter}
                onChange={(event) => setProjectAssigneeFilter(event.target.value)}
              >
                <option value="">All Team Leads</option>
                {assigneeFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
                    <th>Team Lead</th>
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
                      <td colSpan={9} className="empty-cell">
                        {projects.length === 0 ? "No projects available." : "No projects match current filters."}
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => (
                      <tr key={project.projectId}>
                        <td>{project.projectId || "-"}</td>
                        <td>{project.model || project.title || "-"}</td>
                        <td>{project.assigneeUsername || "-"}</td>
                        <td>{project.customer || "-"}</td>
                        <td>{project.category || "-"}</td>
                        <td>{normalizeGyrValue(project.gyrStatus) || "-"}</td>
                        <td>{formatDate(project.sopDate || project.deadline)}</td>
                        <td>{project.statusLatest || "No updates yet"}</td>
                        <td>
                          <button type="button" className="secondary-button" onClick={() => openUpdates(project)}>
                            View Updates
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal
        title={selectedProject ? `Project Updates - ${getProjectDisplayName(selectedProject)}` : "Project Updates"}
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
                      {update.assigneeUsername} | {formatDateTime(update.createdAt)}
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
