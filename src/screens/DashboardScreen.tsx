import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import { firebaseService } from '../services/firebase';
import { cacheService, DocumentDraft } from '../services/cache';
import { SignedDocument, UserSession } from '../types';
import { COLORS } from '../theme/colors';
import { Shimmer } from '../components/Shimmer';
import { SignaturePad } from '../components/SignaturePad';
import Svg, { Path } from 'react-native-svg';

interface DashboardScreenProps {
  user: UserSession;
  onNavigateToEditor: (draftToLoad?: DocumentDraft | null) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  onNavigateToEditor,
}) => {
  const [documents, setDocuments] = useState<SignedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [activeDraft, setActiveDraft] = useState<DocumentDraft | null>(null);
  const [savedSignatureStrokes, setSavedSignatureStrokes] = useState<
    string[] | null
  >(null);
  const [sigCanvasDimensions, setSigCanvasDimensions] = useState({
    width: 300,
    height: 180,
  });
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);

  // Load documents, drafts, and signatures on mount
  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadDashboardData = async () => {
    setIsLoadingDocs(true);
    try {
      // 1. Fetch completed docs from Firebase
      const docs = await firebaseService.getDocuments(user.uid);
      setDocuments(docs);

      // 2. Fetch cached draft
      const draft = await cacheService.getDraft();
      setActiveDraft(draft);

      // 3. Fetch cached signature template
      const sigData = await cacheService.getSignatureTemplate();
      if (sigData) {
        try {
          const parsed = JSON.parse(sigData);
          if (parsed && Array.isArray(parsed.strokes)) {
            setSavedSignatureStrokes(parsed.strokes);
            setSigCanvasDimensions({
              width: parsed.width,
              height: parsed.height,
            });
          }
        } catch {
          // Fallback if cached signature was not JSON
          setSavedSignatureStrokes(null);
        }
      } else {
        setSavedSignatureStrokes(null);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleSaveSignatureTemplate = async (
    strokes: string[],
    width: number,
    height: number,
  ) => {
    const signatureTemplateJson = JSON.stringify({ strokes, width, height });
    await cacheService.saveSignatureTemplate(signatureTemplateJson);
    setSavedSignatureStrokes(strokes);
    setSigCanvasDimensions({ width, height });
    setIsSigModalOpen(false);
    Alert.alert('Success', 'Signature template saved successfully!');
  };

  const handleClearSignatureTemplate = async () => {
    Alert.alert(
      'Remove Signature',
      'Are you sure you want to delete your saved signature template?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await cacheService.clearSignatureTemplate();
            setSavedSignatureStrokes(null);
          },
        },
      ],
    );
  };

  const handleDeleteDraft = async () => {
    Alert.alert(
      'Discard Draft',
      'Are you sure you want to discard your saved draft?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await cacheService.clearDraft();
            setActiveDraft(null);
          },
        },
      ],
    );
  };

  const renderDocumentItem = ({ item }: { item: SignedDocument }) => (
    <View style={styles.documentCard}>
      <View style={styles.docLeft}>
        <View style={styles.docIconBg}>
          <Text style={styles.docIconText}>📝</Text>
        </View>
        <View style={styles.docDetails}>
          <Text style={styles.docName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.docDate}>
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
      </View>
      <View style={styles.docRight}>
        <Text style={styles.docStatusBadge}>Completed</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Hello,</Text>
          <Text style={styles.userName}>{user.displayName || 'User'}</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => firebaseService.logout()}
        >
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Draft Banner */}
        {activeDraft && (
          <View style={styles.draftContainer}>
            <View style={styles.draftHeader}>
              <Text style={styles.draftBadge}>PRACTICAL DRAFT</Text>
              <TouchableOpacity onPress={handleDeleteDraft}>
                <Text style={styles.draftDeleteText}>Discard</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.draftTitle}>
              You have an unfinished document in progress
            </Text>
            <TouchableOpacity
              style={styles.draftResumeBtn}
              onPress={() => onNavigateToEditor(activeDraft)}
            >
              <Text style={styles.draftResumeBtnText}>Resume Signing</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Signature Template Management */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Signature Template</Text>
            {savedSignatureStrokes && (
              <TouchableOpacity onPress={handleClearSignatureTemplate}>
                <Text style={styles.actionLinkText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>

          {savedSignatureStrokes ? (
            <View style={styles.signaturePreviewContainer}>
              <Svg
                width="100%"
                height={100}
                viewBox={`0 0 ${sigCanvasDimensions.width} ${sigCanvasDimensions.height}`}
              >
                {savedSignatureStrokes.map((stroke, index) => (
                  <Path
                    key={index}
                    d={stroke}
                    fill="none"
                    stroke={COLORS.primary}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </Svg>
              <Text style={styles.signatureInfoText}>
                Stored in cache. Drag to place on documents.
              </Text>
            </View>
          ) : (
            <View style={styles.noSignatureContainer}>
              <Text style={styles.noSignatureText}>
                No signature template saved yet.
              </Text>
              <TouchableOpacity
                style={styles.createSigBtn}
                onPress={() => setIsSigModalOpen(true)}
              >
                <Text style={styles.createSigBtnText}>+ Create Template</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Quick Launch Area */}
        <View style={styles.quickLaunchContainer}>
          <TouchableOpacity
            style={styles.launchEditorCard}
            onPress={() => onNavigateToEditor(null)}
          >
            <View style={styles.launchIconBg}>
              <Text style={styles.launchIcon}>✍️</Text>
            </View>
            <Text style={styles.launchTitle}>Sign a Document</Text>
            <Text style={styles.launchSubtitle}>
              Upload a PDF or use a built-in template
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Signed History */}
        <Text style={styles.listTitle}>Recent Documents</Text>

        {isLoadingDocs ? (
          // Shimmer List loader
          <View>
            {[1, 2, 3].map(i => (
              <View key={i} style={styles.shimmerItem}>
                <Shimmer style={styles.shimmerIcon} />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Shimmer style={styles.shimmerLineLong} />
                  <Shimmer style={styles.shimmerLineShort} />
                </View>
              </View>
            ))}
          </View>
        ) : documents.length > 0 ? (
          <FlatList
            data={documents}
            renderItem={renderDocumentItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No signed documents found.</Text>
            <Text style={styles.emptySubtext}>
              Your completed PDFs and images will appear here.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Signature Draw Modal */}
      <Modal
        visible={isSigModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSigModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <SignaturePad
              onSave={handleSaveSignatureTemplate}
              onCancel={() => setIsSigModalOpen(false)}
            />
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
  welcomeText: {
    fontSize: 14,
    color: COLORS.textMedium,
    fontWeight: '500',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  draftContainer: {
    backgroundColor: 'rgba(15, 35, 66, 0.04)',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  draftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  draftBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  draftDeleteText: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '600',
  },
  draftTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 16,
  },
  draftResumeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  draftResumeBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  actionLinkText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
  },
  signaturePreviewContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  signatureInfoText: {
    color: COLORS.textMedium,
    fontSize: 11,
    marginTop: 12,
  },
  noSignatureContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noSignatureText: {
    color: COLORS.textLight,
    fontSize: 14,
    marginBottom: 16,
  },
  createSigBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  createSigBtnText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  quickLaunchContainer: {
    marginBottom: 32,
  },
  launchEditorCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  launchIconBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(209, 161, 83, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  launchIcon: {
    fontSize: 24,
  },
  launchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  launchSubtitle: {
    fontSize: 12,
    color: COLORS.textMedium,
    textAlign: 'center',
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 16,
  },
  documentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  docLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  docIconBg: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docIconText: {
    fontSize: 18,
  },
  docDetails: {
    marginLeft: 12,
    flex: 1,
  },
  docName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  docDate: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  docRight: {
    alignItems: 'flex-end',
  },
  docStatusBadge: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: COLORS.textMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubtext: {
    color: COLORS.textLight,
    fontSize: 12,
    marginTop: 4,
  },
  shimmerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 12,
  },
  shimmerIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  shimmerLineLong: {
    height: 14,
    width: '60%',
    marginBottom: 6,
  },
  shimmerLineShort: {
    height: 10,
    width: '30%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
  },
});
