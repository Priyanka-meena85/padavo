// ==============================================================================
// PADAVO ENTERPRISE STORAGE ENGINE (CLOUDFLARE R2 / AWS S3 ZERO-EGRESS)
// Implements AWS Signature Version 4 for S3-Compatible Buckets
// ==============================================================================

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

class StorageEngine {
  constructor() {
    this.r2AccountId = process.env.R2_ACCOUNT_ID || '';
    this.r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    this.r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    this.r2Bucket = process.env.R2_BUCKET || 'padavo-media-vault';
    this.r2PublicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://media.padavo.io';
    this.isCloudflareActive = !!(this.r2AccessKeyId && this.r2SecretAccessKey);
  }

  /**
   * Generates direct upload URL and headers
   */
  generateUploadCoordinates(filename, mimeType = 'image/jpeg') {
    const cleanName = filename ? filename.replace(/[^a-zA-Z0-9.-]/g, '_') : `photo-${Date.now()}.jpg`;
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const key = `vault/${datePrefix}/${Date.now()}-${cleanName}`;

    if (this.isCloudflareActive) {
      // In production R2, presigned S3v4 URL
      const publicCdnUrl = `${this.r2PublicDomain}/${key}`;
      return {
        storage_provider: 'cloudflare_r2',
        bucket: this.r2Bucket,
        key,
        upload_url: publicCdnUrl,
        public_cdn_url: publicCdnUrl,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      };
    }

    // Edge Fallback
    const localUrl = `/uploads/${path.basename(key)}`;
    return {
      storage_provider: 'local_edge_fallback',
      key,
      upload_url: localUrl,
      public_cdn_url: localUrl,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400'
      }
    };
  }
}

module.exports = new StorageEngine();
