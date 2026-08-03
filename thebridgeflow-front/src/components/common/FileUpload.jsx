import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiUpload, FiX, FiFile } from "react-icons/fi";
import "./FileUpload.css";

export default function FileUpload({
  onUpload,
  currentFile = "",
  accept = ".pdf,.doc,.docx",
  maxSize = 5 * 1024 * 1024,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSize) {
      setError(t("fileUpload.errorTooLarge", { size: Math.round(maxSize / 1024 / 1024) }));
      return;
    }

    setError("");
    onUpload(file);
  };

  const handleRemove = () => {
    setError("");
    onUpload(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="file-upload">
      {currentFile ? (
        <div className="file-upload-preview">
          <FiFile size={18} />
          <span className="file-upload-name">{currentFile}</span>
          <button
            type="button"
            className="file-upload-remove"
            onClick={handleRemove}
            aria-label={t("fileUpload.removeFile")}
          >
            <FiX size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="file-upload-btn"
          onClick={() => inputRef.current?.click()}
        >
          <FiUpload size={18} />
          <span>{t("fileUpload.chooseFile")}</span>
          <span className="file-upload-hint">{t("fileUpload.hint", { size: Math.round(maxSize / 1024 / 1024) })}</span>
        </button>
      )}

      {error && <p className="file-upload-error">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="file-upload-input"
        aria-hidden="true"
      />
    </div>
  );
}
