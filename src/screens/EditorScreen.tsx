import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import Pdf from 'react-native-pdf';
import Share from 'react-native-share';
import { pick, types } from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { COLORS } from '../theme/colors';
import { cacheService, DocumentDraft } from '../services/cache';
import { firebaseService } from '../services/firebase';
import { pdfService } from '../services/pdfService';
import { SignaturePad } from '../components/SignaturePad';
import { DraggableOverlay } from '../components/DraggableOverlay';
import { CustomSlider } from '../components/CustomSlider';
import { Shimmer } from '../components/Shimmer';
import { SignaturePosition, UserSession } from '../types';

interface EditorScreenProps {
  user: UserSession;
  initialDraft?: DocumentDraft | null;
  onNavigateBack: () => void;
}

type EditorMode = 'upload' | 'pdf';

const screenWidth = Dimensions.get('window').width;

export const EditorScreen: React.FC<EditorScreenProps> = ({
  user,
  initialDraft,
  onNavigateBack,
}) => {
  // Core states
  const [editorMode, setEditorMode] = useState<EditorMode>('upload');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState('Signed Document');
  const [signatureStrokes, setSignatureStrokes] = useState<string[] | null>(
    null,
  );
  const [sigDimensions, setSigDimensions] = useState({
    width: 300,
    height: 180,
  });
  const [signaturePosition, setSignaturePosition] =
    useState<SignaturePosition | null>(null);

  // PDF-specific state
  const [uploadedFileUri, setUploadedFileUri] = useState<string | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [pdfAspectRatio, setPdfAspectRatio] = useState<number | null>(null);
  const [pdfViewerDimensions, setPdfViewerDimensions] = useState({
    width: screenWidth - 32,
    height: 500,
  });
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  // Modals / Loading
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);

  // Center modal state
  const [centerModal, setCenterModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: { text: string; onPress?: () => void; style?: 'primary' | 'secondary' | 'danger' }[];
  }>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  const showModal = (
    title: string,
    message: string,
    buttons: { text: string; onPress?: () => void; style?: 'primary' | 'secondary' | 'danger' }[] = [
      { text: 'OK', style: 'primary' },
    ],
  ) => {
    setCenterModal({ visible: true, title, message, buttons });
  };

  const hideModal = () => {
    setCenterModal(prev => ({ ...prev, visible: false }));
  };

  // Load Initial Draft or Saved Signature Template on Mount
  useEffect(() => {
    if (initialDraft) {
      setDocumentId(initialDraft.templateId);
      if (initialDraft.signatureUri) {
        try {
          const parsed = JSON.parse(initialDraft.signatureUri);
          setSignatureStrokes(parsed.strokes);
          setSigDimensions({ width: parsed.width, height: parsed.height });
        } catch {
          setSignatureStrokes(null);
        }
      }
      setSignaturePosition(initialDraft.signaturePosition);
      setDocumentName(initialDraft.documentName || initialDraft.documentUri || 'Draft Document');
      
      // Restore PDF from cached local URI
      if (initialDraft.documentUri) {
        setUploadedFileUri(initialDraft.documentUri);
        setIsLoadingPdf(true);
        pdfService.readFileAsBytes(initialDraft.documentUri)
          .then(bytes => {
            setPdfBytes(bytes);
            return pdfService.getPdfInfo(bytes);
          })
          .then(pageInfo => {
            setPdfTotalPages(pageInfo.length);
            setCurrentPdfPage(1);
            setEditorMode('pdf');
            setIsLoadingPdf(false);
          })
          .catch(err => {
            console.error("Failed to load draft PDF", err);
            setIsLoadingPdf(false);
            showModal('Draft Error', 'Could not load the drafted PDF file.');
          });
      } else if (initialDraft.templateId) {
        setEditorMode('pdf');
      }
    } else {
      loadSavedSignature();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft]);

  const loadSavedSignature = async () => {
    const sigData = await cacheService.getSignatureTemplate();
    if (sigData) {
      try {
        const parsed = JSON.parse(sigData);
        setSignatureStrokes(parsed.strokes);
        setSigDimensions({ width: parsed.width, height: parsed.height });
      } catch {
        // Fallback
      }
    }
  };

  // Document Picker
  const handlePickDocument = async () => {
    try {
      const [result] = await pick({
        type: [types.pdf],
        mode: 'import',
      });

      if (result && result.uri) {
        setIsLoadingPdf(true);
        setDocumentName(result.name || 'Uploaded Document');

        // Copy content:// URI to local cache to avoid permission issues
        // (Google Drive and other providers use ephemeral permissions)
        let localUri = result.uri;
        if (localUri.startsWith('content://')) {
          const tempPath = `${
            ReactNativeBlobUtil.fs.dirs.CacheDir
          }/signify_picked_${Date.now()}.pdf`;
          await ReactNativeBlobUtil.fs.cp(localUri, tempPath);
          localUri = tempPath;
        } else if (localUri.startsWith('file://')) {
          localUri = localUri.replace('file://', '');
        }

        setUploadedFileUri(localUri);

        // Read and parse the PDF from the local copy
        const bytes = await pdfService.readFileAsBytes(localUri);
        setPdfBytes(bytes);

        const pageInfo = await pdfService.getPdfInfo(bytes);
        setPdfTotalPages(pageInfo.length);
        setCurrentPdfPage(1);

        setDocumentId(`uploaded_${Date.now()}`);
        setEditorMode('pdf');
        setIsLoadingPdf(false);
      }
    } catch (err: any) {
      if (err?.code !== 'OPERATION_CANCELED') {
        console.error('Document pick error:', err);
        showModal('Error', 'Failed to open document. Please try again.');
      }
      setIsLoadingPdf(false);
    }
  };

  const handleApplySignature = (
    strokes: string[],
    width: number,
    height: number,
  ) => {
    setSignatureStrokes(strokes);
    setSigDimensions({ width, height });
    setSignaturePosition({
      x: 60,
      y: 350,
      width: 140,
      height: 140 * (height / width),
      scale: 1,
      rotate: 0,
    });
    setIsSigModalOpen(false);
  };

  const handlePositionChange = (pos: SignaturePosition) => {
    setSignaturePosition(pos);
  };

  const handleSaveDraft = async () => {
    if (!documentId) {
      showModal('Draft', 'Please upload a document first.');
      return;
    }
    setIsDrafting(true);
    try {
      const signatureUriStr = signatureStrokes
        ? JSON.stringify({
            strokes: signatureStrokes,
            width: sigDimensions.width,
            height: sigDimensions.height,
          })
        : null;

      await cacheService.saveDraft({
        documentUri: uploadedFileUri || '',
        documentName: documentName,
        templateId: documentId,
        signatureUri: signatureUriStr,
        signaturePosition,
        timestamp: new Date().toISOString(),
      });
      showModal('Draft Saved', 'Your progress has been cached locally.', [
        { text: 'OK', style: 'primary', onPress: onNavigateBack },
      ]);
    } catch (err) {
      console.error(err);
      showModal('Error', 'Could not save draft.');
    } finally {
      setIsDrafting(false);
    }
  };

  // Export: embed signature onto PDF and share
  const handleExport = async () => {
    if (!pdfBytes) {
      showModal('Export Error', 'No PDF loaded.');
      return;
    }
    if (!signatureStrokes || !signaturePosition) {
      showModal(
        'Export Error',
        'Please add and place your signature before exporting.',
      );
      return;
    }

    setIsSaving(true);
    try {
      // Embed signature SVG paths directly onto the PDF
      const signedPdfBytes = await pdfService.embedSignatureOnPdf(
        pdfBytes,
        currentPdfPage - 1, // 0-indexed
        signatureStrokes,
        sigDimensions.width,
        sigDimensions.height,
        signaturePosition,
        pdfViewerDimensions.width,
        pdfViewerDimensions.height,
      );

      // Save to a temp file
      const outputFileName = `Signed_${documentName.replace(
        /\.[^.]+$/,
        '',
      )}.pdf`;
      const outputPath = await pdfService.savePdfToFile(
        signedPdfBytes,
        outputFileName,
      );

      // Save record to Firebase/local DB
      const signatureUriStr = JSON.stringify({
        strokes: signatureStrokes,
        width: sigDimensions.width,
        height: sigDimensions.height,
      });

      await firebaseService.uploadAndSaveDocument(
        user.uid,
        outputFileName,
        `file://${outputPath}`,
        documentId,
        signatureUriStr,
        signaturePosition,
      );

      await cacheService.clearDraft();

      // Share the signed PDF
      await Share.open({
        title: 'Share Signed Document',
        url: Platform.OS === 'android' ? `file://${outputPath}` : outputPath,
        type: 'application/pdf',
        filename: outputFileName,
      }).catch(() => {
        // User cancelled sharing, that's OK
      });

      showModal('Completed', 'Your PDF has been signed and exported! 🎉', [
        { text: 'Done', style: 'primary', onPress: onNavigateBack },
      ]);
    } catch (err: any) {
      console.error('PDF export error:', err);
      showModal(
        'Export Failed',
        err.message || 'An error occurred while signing the PDF.',
        [{ text: 'OK', style: 'danger' }],
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Upload Screen ──────────────────────────────────
  const renderUploadScreen = () => (
    <View style={styles.uploadScreenContainer}>
      <Text style={styles.title}>Upload a Document</Text>
      <Text style={styles.uploadScreenSubtitle}>
        Select a PDF file from your device to add your signature
      </Text>

      <TouchableOpacity
        style={styles.uploadCard}
        onPress={handlePickDocument}
        disabled={isLoadingPdf}
      >
        <View style={styles.uploadIconBg}>
          {isLoadingPdf ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.uploadIcon}>📁</Text>
          )}
        </View>
        <View style={styles.uploadTextCol}>
          <Text style={styles.uploadTitle}>Choose PDF File</Text>
          <Text style={styles.uploadSubtitle}>Tap to browse your files</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  // ─── PDF Document View ──────────────────────────────
  const renderPdfView = () => {
    const source = uploadedFileUri
      ? { uri: uploadedFileUri, cache: true }
      : undefined;

    if (!source) {
      return (
        <View style={styles.pdfLoadingContainer}>
          <Shimmer style={styles.pdfShimmer} />
          <Text style={styles.pdfLoadingText}>Loading document...</Text>
        </View>
      );
    }

    return (
      <ScrollView 
        style={styles.pdfWorkspace}
        contentContainerStyle={styles.pdfWorkspaceContent}
      >
        {/* Page indicator */}
        <View style={styles.pageIndicator}>
          <Text style={styles.pageIndicatorText}>
            Page {currentPdfPage} of {pdfTotalPages}
          </Text>
        </View>

        {/* PDF container with overlay */}
        <View
          style={[
            styles.pdfContainer,
            pdfAspectRatio
              ? { aspectRatio: pdfAspectRatio, flex: undefined }
              : { height: Dimensions.get('window').height * 0.6, flex: undefined },
          ]}
          onLayout={evt => {
            const { width, height } = evt.nativeEvent.layout;
            setPdfViewerDimensions({ width, height });
          }}
        >
          <Pdf
            trustAllCerts={false}
            source={source}
            page={currentPdfPage}
            singlePage={true}
            style={styles.pdfViewer}
            onPageChanged={page => {
              setCurrentPdfPage(page);
            }}
            onLoadComplete={(numberOfPages, _, size) => {
              setPdfTotalPages(numberOfPages);
              if (size && size.width && size.height) {
                setPdfAspectRatio(size.width / size.height);
              }
            }}
            onError={error => {
              console.error('PDF render error:', error);
            }}
          />

          {/* Signature overlay on top of PDF */}
          {signatureStrokes && signaturePosition && (
            <DraggableOverlay
              strokes={signatureStrokes}
              originalWidth={sigDimensions.width}
              originalHeight={sigDimensions.height}
              initialPosition={signaturePosition}
              onPositionChange={handlePositionChange}
              onDelete={() => {
                setSignatureStrokes(null);
                setSignaturePosition(null);
              }}
            />
          )}
        </View>

        {/* Page navigation */}
        {pdfTotalPages > 1 && (
          <View style={styles.pageNavRow}>
            <TouchableOpacity
              style={[
                styles.pageNavBtn,
                currentPdfPage <= 1 && styles.pageNavBtnDisabled,
              ]}
              onPress={() => setCurrentPdfPage(Math.max(1, currentPdfPage - 1))}
              disabled={currentPdfPage <= 1}
            >
              <Text style={styles.pageNavBtnText}>← Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pageNavBtn,
                currentPdfPage >= pdfTotalPages && styles.pageNavBtnDisabled,
              ]}
              onPress={() =>
                setCurrentPdfPage(Math.min(pdfTotalPages, currentPdfPage + 1))
              }
              disabled={currentPdfPage >= pdfTotalPages}
            >
              <Text style={styles.pageNavBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  // ─── Active editor check ────────────────────────────
  const isEditorActive = editorMode === 'pdf';

  return (
    <View style={styles.container}>
      {/* Editor Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (isEditorActive) {
              setEditorMode('upload');
              setDocumentId(null);
              setUploadedFileUri(null);
              setPdfBytes(null);
            } else {
              onNavigateBack();
            }
          }}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        {isEditorActive && (
          <>
            <TextInput
              style={styles.docNameInput}
              value={documentName}
              onChangeText={setDocumentName}
              placeholder="Document Title"
              placeholderTextColor={COLORS.textLight}
            />
            <TouchableOpacity
              style={styles.saveDraftBtn}
              onPress={handleSaveDraft}
              disabled={isDrafting}
            >
              {isDrafting ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.saveDraftBtnText}>Save Draft</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Editor Workspace */}
      <View style={styles.workspace}>
        {editorMode === 'upload' && renderUploadScreen()}
        {editorMode === 'pdf' && renderPdfView()}
      </View>

      {/* Control Bar */}
      {isEditorActive && (
        <View style={styles.bottomSection}>
          {signatureStrokes && signaturePosition && (
            <CustomSlider
              label="Signature Size"
              value={signaturePosition.scale}
              min={0.15}
              max={0.7}
              onValueChange={newScale => {
                setSignaturePosition({
                  ...signaturePosition,
                  scale: newScale,
                  width: sigDimensions.width * newScale,
                  height: sigDimensions.height * newScale,
                });
              }}
            />
          )}
          <View style={styles.controlBar}>
            {!signatureStrokes ? (
              <TouchableOpacity
                style={styles.addSigBtn}
                onPress={() => setIsSigModalOpen(true)}
              >
                <Text style={styles.addSigBtnText}>✍️ Add Signature</Text>
              </TouchableOpacity>
            ) : !signaturePosition ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={styles.addSigBtn}
                  onPress={() => {
                    setSignaturePosition({
                      x: 60,
                      y: 350,
                      width: 140,
                      height:
                        140 * (sigDimensions.height / sigDimensions.width),
                      scale: 1,
                      rotate: 0,
                    });
                  }}
                >
                  <Text style={styles.addSigBtnText}>✍️ Sign</Text>
                </TouchableOpacity>
                {/* <TouchableOpacity
                  style={styles.changeSigBtn}
                  onPress={() => setIsSigModalOpen(true)}
                >
                  <Text style={styles.changeSigBtnText}>✍️ Draw New</Text>
                </TouchableOpacity> */}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.changeSigBtn}
                onPress={() => setIsSigModalOpen(true)}
              >
                <Text style={styles.changeSigBtnText}>✍️ Change</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.exportBtn,
                !signatureStrokes && styles.disabledExport,
              ]}
              onPress={handleExport}
              disabled={isSaving || !signatureStrokes}
            >
              {isSaving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.exportBtnText}>📥 Sign & Download</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Signature drawing modal */}
      <Modal
        visible={isSigModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSigModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <SignaturePad
              onSave={handleApplySignature}
              onCancel={() => setIsSigModalOpen(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Center alert modal */}
      <Modal
        visible={centerModal.visible}
        animationType="fade"
        transparent={true}
        onRequestClose={hideModal}
        statusBarTranslucent
      >
        <View style={styles.centerModalOverlay}>
          <View style={styles.centerModalCard}>
            <Text style={styles.centerModalTitle}>{centerModal.title}</Text>
            <Text style={styles.centerModalMessage}>{centerModal.message}</Text>
            <View style={styles.centerModalButtons}>
              {centerModal.buttons.map((btn, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.centerModalBtn,
                    btn.style === 'danger' && styles.centerModalBtnDanger,
                    btn.style === 'secondary' && styles.centerModalBtnSecondary,
                    (!btn.style || btn.style === 'primary') && styles.centerModalBtnPrimary,
                    centerModal.buttons.length > 1 && { flex: 1 },
                  ]}
                  onPress={() => {
                    hideModal();
                    btn.onPress?.();
                  }}
                >
                  <Text
                    style={[
                      styles.centerModalBtnText,
                      btn.style === 'secondary' && styles.centerModalBtnTextSecondary,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  docNameInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    color: COLORS.textDark,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: COLORS.background,
  },
  saveDraftBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  saveDraftBtnText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  workspace: {
    flex: 1,
  },
  // ─── Upload Screen ────────────────────────────
  uploadScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadScreenSubtitle: {
    fontSize: 14,
    color: COLORS.textMedium,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  uploadCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    width: '100%',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  uploadIconBg: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 35, 66, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadIcon: {
    fontSize: 24,
  },
  uploadTextCol: {
    marginLeft: 16,
    flex: 1,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  uploadSubtitle: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginTop: 4,
  },
  // ─── PDF View ─────────────────────────────────
  pdfWorkspace: {
    flex: 1,
  },
  pdfWorkspaceContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  pageIndicator: {
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
  },
  pageIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  pdfContainer: {
    flex: 1,
    width: Dimensions.get('window').width - 32,
    position: 'relative',
    margin: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  pdfViewer: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  pageNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  pageNavBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageNavBtnText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  pdfLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  pdfShimmer: {
    width: '80%',
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  pdfLoadingText: {
    color: COLORS.textMedium,
    fontSize: 14,
  },
  // ─── Control Bar ──────────────────────────────
  bottomSection: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
    paddingTop: 10,
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 4,
  },
  addSigBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  addSigBtnText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  changeSigBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  changeSigBtnText: {
    color: COLORS.textMedium,
    fontWeight: 'bold',
    fontSize: 14,
  },
  exportBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  exportBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  disabledExport: {
    backgroundColor: COLORS.textLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  // ─── Signature Modal ──────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
  },
  // ─── Center Alert Modal ───────────────────────
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  centerModalCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  centerModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 10,
    textAlign: 'center',
  },
  centerModalMessage: {
    fontSize: 14,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  centerModalButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  centerModalBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerModalBtnPrimary: {
    backgroundColor: COLORS.primary,
    flex: 1,
  },
  centerModalBtnDanger: {
    backgroundColor: '#EF4444',
    flex: 1,
  },
  centerModalBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    flex: 1,
  },
  centerModalBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  centerModalBtnTextSecondary: {
    color: COLORS.textMedium,
  },
});
