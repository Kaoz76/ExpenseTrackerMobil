import React from 'react';
import { useDropzone } from 'react-dropzone';
import { FaCloudUploadAlt } from 'react-icons/fa';
import { useLanguage } from '../../context/LanguageContext';

function ReceiptScanZone({
  onDrop,
  error,
  isUploading,
  uploadProgress,
  statusText,
  privacyMode,
  setPrivacyMode,
  shouldAnalyzeWithLLM,
  setShouldAnalyzeWithLLM
}) {
  const { t } = useLanguage();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'application/pdf': [] },
    maxSize: 10485760
  });

  return (
    <div className="mb-5">
      <h1 className="display-6 fw-bold">{t('common.scan_new_receipt')}</h1>
      <p className="text-muted">{t('common.upload_image')}</p>
      {error && <div className="alert alert-danger">{error}</div>}

      <div
        {...getRootProps()}
        className={`dropzone-container ${isDragActive ? 'dropzone-active' : ''}`}
      >
        <input {...getInputProps()} />
        <FaCloudUploadAlt className="dropzone-icon mb-3" />
        <p className="mb-1">
          <span className="dropzone-link-text">{t('common.click_to_upload')}</span> {t('common.or_drag_drop')}
        </p>
        <p className="text-muted small">{t('common.file_limits')}</p>
      </div>

      <div className="form-check mt-3 d-flex justify-content-center align-items-center">
        <input
          className="form-check-input me-2 mt-0"
          type="checkbox"
          id="privacyModeCheckbox"
          checked={privacyMode}
          onChange={(e) => setPrivacyMode(e.target.checked)}
          style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
        />
        <label className="form-check-label text-muted" htmlFor="privacyModeCheckbox" style={{ cursor: 'pointer', userSelect: 'none' }}>
          {t('common.privacy_toggle_label')}
        </label>
      </div>

      <div className="form-check mt-2 d-flex justify-content-center align-items-center">
        <input
          className="form-check-input me-2 mt-0"
          type="checkbox"
          id="analyzeWithLLMCheckbox"
          checked={shouldAnalyzeWithLLM}
          onChange={(e) => setShouldAnalyzeWithLLM(e.target.checked)}
          style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
        />
        <label className="form-check-label text-muted" htmlFor="analyzeWithLLMCheckbox" style={{ cursor: 'pointer', userSelect: 'none' }}>
          {t('common.analyze_with_llm')}
        </label>
      </div>

      {isUploading && (
        <div className="mt-4 mb-2">
          <h3 className="h5 mb-3">{t('common.processing')}</h3>
          <div className="progress" style={{ height: '20px' }}>
            <div
              className="progress-bar progress-bar-striped progress-bar-animated"
              role="progressbar"
              style={{ width: `${uploadProgress}%` }}
              aria-valuenow={uploadProgress}
            >
              {uploadProgress.toFixed(0)}%
            </div>
          </div>
          <p className="mt-2 text-muted">{statusText}</p>
        </div>
      )}
    </div>
  );
}

export default ReceiptScanZone;
