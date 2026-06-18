export interface UserSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
}

export interface SignatureTemplate {
  id: string;
  uri: string; // Base64 signature path or file URI
  createdAt: string;
}

export interface SignaturePosition {
  x: number;     // X coordinate relative to container width
  y: number;     // Y coordinate relative to container height
  scale: number; // Scale factor (default 1.0)
  rotate: number; // Rotation in degrees (default 0)
  width: number;
  height: number;
}

export interface SignedDocument {
  id: string;
  name: string;
  originalUri: string | null; // Null if using templates
  signedUri: string | null;   // Local or remote URI of finalized document image
  createdAt: string;
  status: 'draft' | 'completed';
  signaturePosition?: SignaturePosition;
  signatureUri?: string;      // The signature image applied
}

export interface DocumentTemplate {
  id: string;
  name: string;
  thumbnail: string;          // Placeholder or template image reference
}
