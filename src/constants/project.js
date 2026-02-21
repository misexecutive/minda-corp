export const LEGACY_TYPE_OPTIONS = ["Legacy", "Key less"];
export const CATEGORY_OPTIONS = ["A", "B", "C"];
export const MAJOR_MINOR_OPTIONS = [
  { value: "MA", label: "Major (MA)" },
  { value: "MI", label: "Minor (MI)" },
];
export const GYR_OPTIONS = [
  { value: "G", label: "Green (G)" },
  { value: "Y", label: "Yellow (Y)" },
  { value: "R", label: "Red (R)" },
];

export const EMPTY_PROJECT_FORM = {
  assigneeUserId: "",
  legacyType: "",
  customer: "",
  imageUrl: "",
  imageDataUrl: "",
  imageName: "",
  model: "",
  productDescription: "",
  category: "",
  majorMinor: "",
  effortDays: "",
  platform: "",
  sopDate: "",
  volumeLacs: "",
  businessPotentialLacs: "",
  gyrStatus: "",
};

const REQUIRED_FIELDS = [
  ["legacyType", "Legacy/Key less"],
  ["customer", "Customer"],
  ["model", "Model"],
  ["productDescription", "Product description"],
  ["category", "Category (A/B/C)"],
  ["majorMinor", "Major/Minor"],
  ["effortDays", "Effort days"],
  ["platform", "Platform"],
  ["sopDate", "SOP date"],
  ["volumeLacs", "Volume (lacs)"],
  ["businessPotentialLacs", "Business potential (lacs)"],
  ["gyrStatus", "GYR"],
];

function hasNumericValue(value) {
  return /^(\d+(\.\d+)?)$/.test(String(value || "").trim());
}

export function getProjectDisplayName(project) {
  return project?.model || project?.title || "Untitled Project";
}

export function validateProjectForm(projectForm, { requireTeamLead = false } = {}) {
  if (requireTeamLead && !String(projectForm.assigneeUserId || "").trim()) {
    return "Team lead is required.";
  }

  const missing = REQUIRED_FIELDS.filter(([key]) => !String(projectForm[key] || "").trim()).map(([, label]) => label);
  if (missing.length > 0) {
    return `${missing[0]} is required.`;
  }

  if (!hasNumericValue(projectForm.effortDays)) {
    return "Effort days must be a valid number.";
  }

  if (!hasNumericValue(projectForm.volumeLacs)) {
    return "Volume (lacs) must be a valid number.";
  }

  if (!hasNumericValue(projectForm.businessPotentialLacs)) {
    return "Business potential (lacs) must be a valid number.";
  }

  const imageUrl = String(projectForm.imageUrl || "").trim();
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    return "Image URL must start with http:// or https://";
  }

  return "";
}

export function toProjectPayload(projectForm, { includeAssignee = false } = {}) {
  const payload = {
    title: projectForm.model.trim(),
    description: projectForm.productDescription.trim(),
    deadline: projectForm.sopDate || "",
    legacyType: projectForm.legacyType.trim(),
    customer: projectForm.customer.trim(),
    imageUrl: projectForm.imageUrl.trim(),
    imageDataUrl: projectForm.imageDataUrl || "",
    imageName: projectForm.imageName || "",
    model: projectForm.model.trim(),
    productDescription: projectForm.productDescription.trim(),
    category: projectForm.category.trim(),
    majorMinor: projectForm.majorMinor.trim(),
    effortDays: projectForm.effortDays.trim(),
    platform: projectForm.platform.trim(),
    sopDate: projectForm.sopDate || "",
    volumeLacs: projectForm.volumeLacs.trim(),
    businessPotentialLacs: projectForm.businessPotentialLacs.trim(),
    gyrStatus: projectForm.gyrStatus.trim(),
  };

  if (includeAssignee) {
    payload.assigneeUserId = projectForm.assigneeUserId;
  }

  return payload;
}
