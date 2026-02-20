export default function Spinner({ size = "small" }) {
  return <span className={`spinner spinner--${size}`} aria-hidden="true" />;
}

