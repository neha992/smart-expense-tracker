import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  Camera,
  Upload,
  Brain,
  ShieldCheck,
  Lightbulb,
  Save,
  X,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";

// Categories accepted by the Transaction model.
const ALLOWED_CATEGORIES = [
  "Food",
  "Travel",
  "Shopping",
  "Bills",
  "Education",
  "Healthcare",
  "Salary",
  "Other",
];

// Map categories returned by the OCR service that are not in the
// Transaction model to the closest allowed equivalent.
const mapCategory = (raw) => {
  if (!raw) return "Other";
  if (ALLOWED_CATEGORIES.includes(raw)) return raw;
  // "Entertainment" is returned by the service but not accepted by the model.
  const lower = raw.toLowerCase();
  if (lower === "entertainment") return "Shopping";
  return "Other";
};

const ReceiptScanner = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ── Upload / camera state ─────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [source, setSource] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // ── Analysis state ────────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // ── Review form state (shown after successful analysis) ───────
  const [reviewData, setReviewData] = useState(null);
  // Editable fields
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCategory, setEditCategory] = useState("Other");
  // Validation errors for the review form
  const [fieldErrors, setFieldErrors] = useState({});
  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Camera helpers ────────────────────────────────────────────
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch((error) => {
      console.error("Video playback error:", error);
    });
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Camera access is not supported here. Please use Upload Receipt."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      console.error("Camera access error:", error);
      if (error.name === "NotAllowedError") {
        setCameraError(
          "Camera permission was denied. Allow camera access in your browser settings and try again."
        );
      } else if (error.name === "NotFoundError") {
        setCameraError(
          "No camera was found on this device. Please use Upload Receipt."
        );
      } else if (error.name === "NotReadableError") {
        setCameraError(
          "The camera is already being used by another application. Close other camera apps and try again."
        );
      } else {
        setCameraError(
          "Unable to access the camera. Please check your camera permissions or use Upload Receipt."
        );
      }
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setCameraError(
        "Camera is not ready yet. Please wait until the live preview appears."
      );
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Unable to capture the image. Please try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Could not create the captured image.");
          return;
        }
        const file = new File([blob], `receipt-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        if (file.size > 5 * 1024 * 1024) {
          setCameraError(
            "Captured image is larger than 5 MB. Please try again."
          );
          return;
        }
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(file);
        setSelectedFile(file);
        setPreviewUrl(url);
        setSource("camera");
        setCameraError("");
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCameraError("Please select an image file.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCameraError("Receipt image must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    setSource("upload");
    setCameraError("");
    // Clear any previous review when a new file is chosen.
    resetReview();
    event.target.value = "";
  };

  const handleRemove = () => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl("");
    setSource("");
    setCameraError("");
    resetReview();
  };

  // ── Review helpers ────────────────────────────────────────────
  const resetReview = () => {
    setReviewData(null);
    setEditMerchant("");
    setEditAmount("");
    setEditDate("");
    setEditCategory("Other");
    setFieldErrors({});
    setAnalyzeError("");
    setSaveError("");
    setSaveSuccess(false);
  };

  const populateReviewForm = (receipt) => {
    setEditMerchant(receipt.merchant || "");
    setEditAmount(receipt.amount != null ? String(receipt.amount) : "");
    setEditDate(receipt.date || "");
    setEditCategory(mapCategory(receipt.category));
    setFieldErrors({});
    setSaveError("");
    setSaveSuccess(false);
  };

  // ── Analyze ───────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!selectedFile) {
      setAnalyzeError("Please scan or upload a receipt first.");
      return;
    }

    setAnalyzing(true);
    setAnalyzeError("");
    resetReview();

    try {
      const formData = new FormData();
      // Field name must match multer's upload.single("receipt") on the backend.
      formData.append("receipt", selectedFile);

      // Do NOT manually set Content-Type when using FormData —
      // the browser adds the correct multipart boundary automatically.
      const response = await api.post("/receipts/analyze", formData);

      console.log("Receipt analysis response:", response.data);

      const receipt = response.data?.receipt;
      if (!receipt) {
        setAnalyzeError(
          "The server returned an unexpected response. Please try again."
        );
        return;
      }

      setReviewData(receipt);
      populateReviewForm(receipt);
    } catch (error) {
      console.error("Receipt analysis error:", error);
      const message =
        error.response?.data?.message ||
        "Unable to analyze the receipt. Please make sure the backend is running and try again.";
      setAnalyzeError(message);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Validate & Save ───────────────────────────────────────────
  const validateReviewForm = () => {
    const errors = {};
    const parsedAmount = parseFloat(editAmount);

    if (!editMerchant.trim()) {
      errors.merchant = "Merchant / description is required.";
    }
    if (!editAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = "Amount must be a number greater than zero.";
    }
    if (!editDate) {
      errors.date = "Date is required.";
    } else {
      const d = new Date(editDate);
      if (isNaN(d.getTime())) {
        errors.date = "Please enter a valid date.";
      }
    }
    if (!ALLOWED_CATEGORIES.includes(editCategory)) {
      errors.category = "Please select a valid category.";
    }
    return errors;
  };

  const handleSave = async () => {
    const errors = validateReviewForm();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // The backend needs the fingerprint generated during analysis.
    if (!reviewData?.receiptFingerprint) {
      setSaveError(
        "Receipt fingerprint is missing. Please analyze the receipt again."
      );
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      await api.post("/receipts/save", {
        merchant: editMerchant.trim(),
        amount: Number(editAmount),
        date: editDate,
        category: editCategory,
        receiptFingerprint: reviewData.receiptFingerprint,
      });

      setSaveSuccess(true);
    } catch (error) {
      console.error("Receipt save error:", error);

      const status = error.response?.status;
      const message = error.response?.data?.message;

      if (status === 409) {
        setSaveError(
          message || "This receipt has already been saved."
        );
      } else if (status === 400) {
        setSaveError(
          message || "The receipt details are invalid. Please check them."
        );
      } else {
        setSaveError(
          message ||
          "Failed to save the receipt. Your edits have been kept. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    resetReview();
  };

  const handleScanAnother = () => {
    handleRemove();
  };

  const handleViewTransactions = () => {
    navigate("/transactions");
  };

  // ── Confidence badge ──────────────────────────────────────────
  const confidenceBadge = (confidence) => {
    if (confidence >= 75)
      return { label: `${confidence}% High`, cls: "rs-confidence-high" };
    if (confidence >= 45)
      return { label: `${confidence}% Medium`, cls: "rs-confidence-medium" };
    return { label: `${confidence}% Low`, cls: "rs-confidence-low" };
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="receipt-scanner-page">
      <div className="receipt-scanner-header">
        <div>
          <h1>Scan Receipt</h1>
          <p>
            Capture or upload a receipt and let Smart Expense Tracker analyze
            it automatically.
          </p>
        </div>
      </div>

      {/* ── Step 1: File selection ── */}
      {!selectedFile && !cameraOpen && (
        <>
          <div className="receipt-options">
            <button
              type="button"
              className="receipt-option"
              onClick={openCamera}
            >
              <span className="receipt-option-icon">
                <Camera size={32} />
              </span>
              <span className="receipt-option-title">Scan with Camera</span>
              <span className="receipt-option-description">
                Take a photo of your receipt or bill
              </span>
            </button>

            <button
              type="button"
              className="receipt-option"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="receipt-option-icon">
                <Upload size={32} />
              </span>
              <span className="receipt-option-title">Upload Receipt</span>
              <span className="receipt-option-description">
                Choose a receipt image from your device
              </span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={handleFileChange}
          />

          {cameraError && (
            <div className="receipt-camera-error">{cameraError}</div>
          )}
        </>
      )}

      {/* ── Camera view ── */}
      {cameraOpen && (
        <div className="receipt-camera-card">
          <div className="receipt-preview-header">
            <div>
              <h2>Camera</h2>
              <p>Position the receipt inside the frame.</p>
            </div>
            <button
              type="button"
              className="receipt-secondary-button"
              onClick={() => {
                stopCamera();
                setCameraError("");
              }}
            >
              <X size={18} />
              Close
            </button>
          </div>

          <div className="receipt-camera-preview">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="receipt-camera-video"
              onLoadedMetadata={() => {
                videoRef.current?.play().catch(() => { });
              }}
            />
            <div className="receipt-camera-frame" />
          </div>

          <div className="receipt-camera-guide">
            Keep the receipt flat, well-lit, and fully visible.
          </div>

          {cameraError && (
            <div className="receipt-camera-error">{cameraError}</div>
          )}

          <div className="receipt-camera-actions">
            <button
              type="button"
              className="receipt-secondary-button"
              onClick={() => {
                stopCamera();
                setCameraError("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="receipt-primary-button receipt-capture-button"
              onClick={capturePhoto}
            >
              <Camera size={18} />
              Capture Photo
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview & Analyze ── */}
      {selectedFile && !cameraOpen && (
        <div className="receipt-preview-section">
          <div className="receipt-preview-card">
            <div className="receipt-preview-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2>Receipt Preview</h2>
                <p>
                  {source === "camera"
                    ? "Captured from camera"
                    : "Uploaded from device"}
                </p>
              </div>
            </div>

            <div className="receipt-image-container">
              <img
                src={previewUrl}
                alt="Selected receipt"
                className="receipt-preview-image"
              />
            </div>

            <div className="receipt-file-info">
              <strong>{selectedFile.name}</strong>
              <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>

            {/* Analyze error */}
            {analyzeError && (
              <div className="rs-error-banner">
                <AlertTriangle size={16} />
                {analyzeError}
              </div>
            )}

            <div className="receipt-actions">
              <button
                type="button"
                className="receipt-secondary-button"
                onClick={handleRemove}
                disabled={analyzing}
              >
                <RotateCcw size={18} />
                Choose Another
              </button>

              <button
                type="button"
                className="receipt-primary-button"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <Loader2 size={18} className="rs-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Brain size={18} />
                    Analyze Receipt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Save form ── */}
      {reviewData && !saveSuccess && (
        <div className="rs-review-section">
          <div className="rs-review-card">
            {/* Header */}
            <div className="rs-review-header">
              <div>
                <h2>Review Extracted Details</h2>
                <p>
                  Verify and correct the fields below before saving the
                  transaction.
                </p>
              </div>

              {/* Confidence badge */}
              {reviewData.confidence != null && (
                <span className={`rs-confidence-badge ${confidenceBadge(reviewData.confidence).cls}`}>
                  {confidenceBadge(reviewData.confidence).label}
                </span>
              )}
            </div>

            {/* Warnings / needs-review banner */}
            {(reviewData.needsReview || (reviewData.warnings && reviewData.warnings.length > 0)) && (
              <div className="rs-warning-banner">
                <AlertTriangle size={18} className="rs-warning-icon" />
                <div>
                  <strong>Please verify these details carefully</strong>
                  {reviewData.warnings && reviewData.warnings.length > 0 && (
                    <ul className="rs-warning-list">
                      {reviewData.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Editable form */}
            <div className="rs-form">
              {/* Merchant */}
              <div className="form-group">
                <label htmlFor="rs-merchant">Merchant / Description</label>
                <input
                  id="rs-merchant"
                  type="text"
                  value={editMerchant}
                  onChange={(e) => {
                    setEditMerchant(e.target.value);
                    if (fieldErrors.merchant)
                      setFieldErrors((p) => ({ ...p, merchant: "" }));
                  }}
                  placeholder="e.g. Reliance Fresh"
                />
                {fieldErrors.merchant && (
                  <span className="field-error">{fieldErrors.merchant}</span>
                )}
              </div>

              <div className="form-row">
                {/* Amount */}
                <div className="form-group">
                  <label htmlFor="rs-amount">Amount (₹)</label>
                  <input
                    id="rs-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => {
                      setEditAmount(e.target.value);
                      if (fieldErrors.amount)
                        setFieldErrors((p) => ({ ...p, amount: "" }));
                    }}
                    placeholder="0.00"
                  />
                  {fieldErrors.amount && (
                    <span className="field-error">{fieldErrors.amount}</span>
                  )}
                </div>

                {/* Date */}
                <div className="form-group">
                  <label htmlFor="rs-date">Date</label>
                  <input
                    id="rs-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => {
                      setEditDate(e.target.value);
                      if (fieldErrors.date)
                        setFieldErrors((p) => ({ ...p, date: "" }));
                    }}
                  />
                  {fieldErrors.date && (
                    <span className="field-error">{fieldErrors.date}</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                {/* Category */}
                <div className="form-group">
                  <label htmlFor="rs-category">Category</label>
                  <select
                    id="rs-category"
                    value={editCategory}
                    onChange={(e) => {
                      setEditCategory(e.target.value);
                      if (fieldErrors.category)
                        setFieldErrors((p) => ({ ...p, category: "" }));
                    }}
                  >
                    {ALLOWED_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.category && (
                    <span className="field-error">{fieldErrors.category}</span>
                  )}
                </div>

                {/* Type */}
                <div className="form-group">
                  <label htmlFor="rs-type">Transaction Type</label>
                  <select id="rs-type" value="expense" disabled>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>

              {/* Save error */}
              {saveError && (
                <div className="rs-error-banner">
                  <AlertTriangle size={16} />
                  {saveError}
                </div>
              )}

              {/* Actions */}
              <div className="rs-form-actions">
                <button
                  type="button"
                  className="receipt-secondary-button"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X size={18} />
                  Cancel
                </button>

                <button
                  type="button"
                  className="receipt-primary-button"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="rs-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Confirm &amp; Save Expense
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Success state ── */}
      {saveSuccess && (
        <div className="rs-success-section">
          <div className="rs-success-card">
            <CheckCircle size={48} className="rs-success-icon" />
            <h2>Transaction Saved!</h2>
            <p>
              <strong>{editMerchant}</strong> — ₹{parseFloat(editAmount).toFixed(2)} (
              {editCategory}) has been added to your transactions.
            </p>
            <div className="rs-success-actions">
              <button
                type="button"
                className="receipt-primary-button"
                onClick={handleViewTransactions}
              >
                View Transactions
              </button>
              <button
                type="button"
                className="receipt-secondary-button"
                onClick={handleScanAnother}
              >
                <Camera size={18} />
                Scan Another Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Processing flow guide ── */}
      <div className="receipt-flow">
        <div className="receipt-flow-title">What happens after scanning?</div>
        <div className="receipt-flow-steps">
          <span>
            <Camera size={16} />
            Capture
          </span>
          <span className="receipt-flow-arrow">›</span>
          <span>
            <Brain size={16} />
            OCR
          </span>
          <span className="receipt-flow-arrow">›</span>
          <span>
            <ShieldCheck size={16} />
            Verify
          </span>
          <span className="receipt-flow-arrow">›</span>
          <span>
            <Lightbulb size={16} />
            Review
          </span>
          <span className="receipt-flow-arrow">›</span>
          <span>
            <Save size={16} />
            Save
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReceiptScanner;
