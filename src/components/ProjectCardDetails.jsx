import { useEffect, useMemo, useState } from "react";
import { formatDate, formatDateTime } from "./formatters";

function normalizeGyr(value) {
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

function gyrClassName(value) {
  const normalized = normalizeGyr(value);
  if (normalized === "G") {
    return "gyr-badge gyr-badge--g";
  }
  if (normalized === "Y") {
    return "gyr-badge gyr-badge--y";
  }
  if (normalized === "R") {
    return "gyr-badge gyr-badge--r";
  }
  return "gyr-badge";
}

function displayValue(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

export default function ProjectCardDetails({ project, actions }) {
  const imageUrl = String(project.imageUrl || "").trim();
  const [showImage, setShowImage] = useState(Boolean(imageUrl));

  useEffect(() => {
    setShowImage(Boolean(imageUrl));
  }, [imageUrl]);

  const title = useMemo(() => project.model || project.title || "Untitled Project", [project.model, project.title]);
  const description = useMemo(
    () => project.productDescription || project.description || "-",
    [project.description, project.productDescription]
  );
  const sopDate = project.sopDate || project.deadline;
  const gyr = normalizeGyr(project.gyrStatus);

  return (
    <article className="project-card">
      <div className="project-card__head">
        <h3>{title}</h3>
        <span className="pill">{project.projectId}</span>
      </div>

      <p className="status-text">{description}</p>

      {showImage ? (
        <div className="project-media">
          <img
            className="project-media__img"
            src={imageUrl}
            alt={`${title} visual`}
            loading="lazy"
            onError={() => setShowImage(false)}
          />
        </div>
      ) : (
        <div className="project-media project-media--empty">No image available</div>
      )}

      <div className="project-meta-grid">
        <p>
          <span className="project-field__label">Team Lead:</span> {displayValue(project.assigneeUsername)}
        </p>
        <p>
          <span className="project-field__label">Legacy/Key less:</span> {displayValue(project.legacyType)}
        </p>
        <p>
          <span className="project-field__label">Customer:</span> {displayValue(project.customer)}
        </p>
        <p>
          <span className="project-field__label">Category:</span> {displayValue(project.category)}
        </p>
        <p>
          <span className="project-field__label">Major/Minor:</span> {displayValue(project.majorMinor)}
        </p>
        <p>
          <span className="project-field__label">Effort Days:</span> {displayValue(project.effortDays)}
        </p>
        <p>
          <span className="project-field__label">Platform:</span> {displayValue(project.platform)}
        </p>
        <p>
          <span className="project-field__label">SOP Date:</span> {formatDate(sopDate)}
        </p>
        <p>
          <span className="project-field__label">Volume (Lacs):</span> {displayValue(project.volumeLacs)}
        </p>
        <p>
          <span className="project-field__label">Business Potential (Lacs):</span>{" "}
          {displayValue(project.businessPotentialLacs)}
        </p>
        <p>
          <span className="project-field__label">GYR:</span>{" "}
          {gyr ? <span className={gyrClassName(gyr)}>{gyr}</span> : "-"}
        </p>
        <p>
          <span className="project-field__label">Created:</span> {formatDateTime(project.createdAt)}
        </p>
      </div>

      <p className="status-text">Latest: {project.statusLatest || "No updates yet"}</p>
      {actions ? <div className="button-row">{actions}</div> : null}
    </article>
  );
}
