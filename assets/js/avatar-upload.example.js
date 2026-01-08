/**
 * Avatar Upload Example
 * Demonstrates how to use Firebase Storage with the security rules
 *
 * ✅ P0 SECURITY: Client-side validation before upload
 * ✅ P1 UI/UX: Progress indication and error handling
 * ✅ P1 PERFORMANCE: Image optimization before upload
 */

'use strict';

// ===================================
// CONSTANTS
// ===================================
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const MAX_DIMENSION = 1024; // Max width/height in pixels

// ===================================
// ✅ P0 SECURITY: CLIENT-SIDE VALIDATION
// ===================================

/**
 * Validate file before upload
 * @param {File} file - The file to validate
 * @returns {Object} { valid: boolean, error: string }
 */
function validateAvatarFile(file) {
    if (!file) {
        return { valid: false, error: 'Keine Datei ausgewählt' };
    }

    // Check file size
    if (file.size > MAX_AVATAR_SIZE) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        return {
            valid: false,
            error: `Datei zu groß (${sizeMB} MB). Max: 5 MB`
        };
    }

    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `Ungültiger Dateityp (${file.type}). Erlaubt: PNG, JPEG, WEBP, GIF`
        };
    }

    return { valid: true };
}

// ===================================
// ✅ P1 PERFORMANCE: IMAGE OPTIMIZATION
// ===================================

/**
 * Resize image to max dimensions
 * @param {File} file - Original image file
 * @param {number} maxDimension - Max width/height
 * @returns {Promise<Blob>} Optimized image blob
 */
async function optimizeImage(file, maxDimension = MAX_DIMENSION) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions
            if (width > height) {
                if (width > maxDimension) {
                    height *= maxDimension / width;
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width *= maxDimension / height;
                    height = maxDimension;
                }
            }

            // Resize
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Image optimization failed'));
                }
            }, file.type, 0.9); // 90% quality
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

// ===================================
// ✅ UPLOAD FUNCTION
// ===================================

/**
 * Upload avatar to Firebase Storage
 * @param {File} file - The image file to upload
 * @param {Function} onProgress - Progress callback (percent)
 * @returns {Promise<string>} Download URL of uploaded file
 */
async function uploadAvatar(file, onProgress = null) {
    try {
        // 1. Validate file
        const validation = validateAvatarFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // 2. Get current user
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Nicht angemeldet');
        }

        // 3. Optimize image
        console.log('🖼️ Optimizing image...');
        const optimizedBlob = await optimizeImage(file);
        console.log(`✅ Optimized: ${file.size} → ${optimizedBlob.size} bytes`);

        // 4. Generate filename
        const timestamp = Date.now();
        const extension = file.name.split('.').pop();
        const filename = `avatar_${timestamp}.${extension}`;

        // 5. Create storage reference
        const storageRef = firebase.storage().ref();
        const avatarRef = storageRef.child(`avatars/${user.uid}/${filename}`);

        // 6. Upload file
        console.log(`📤 Uploading to: avatars/${user.uid}/${filename}`);
        const uploadTask = avatarRef.put(optimizedBlob, {
            contentType: file.type,
            customMetadata: {
                uploadedBy: user.uid,
                originalName: file.name,
                uploadedAt: new Date().toISOString()
            }
        });

        // 7. Monitor progress
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`📊 Upload progress: ${progress.toFixed(2)}%`);

                if (onProgress) {
                    onProgress(progress);
                }
            },
            (error) => {
                console.error('❌ Upload error:', error);
                throw error;
            }
        );

        // 8. Wait for completion
        await uploadTask;

        // 9. Get download URL
        const downloadURL = await avatarRef.getDownloadURL();
        console.log('✅ Upload complete:', downloadURL);

        return downloadURL;

    } catch (error) {
        console.error('❌ Avatar upload failed:', error);

        // User-friendly error messages
        if (error.code === 'storage/unauthorized') {
            throw new Error('Keine Berechtigung. Bist du angemeldet?');
        } else if (error.code === 'storage/canceled') {
            throw new Error('Upload abgebrochen');
        } else if (error.code === 'storage/unknown') {
            throw new Error('Upload fehlgeschlagen. Bitte erneut versuchen.');
        }

        throw error;
    }
}

// ===================================
// ✅ DELETE FUNCTION
// ===================================

/**
 * Delete avatar from Firebase Storage
 * @param {string} avatarURL - The download URL or path of the avatar
 * @returns {Promise<void>}
 */
async function deleteAvatar(avatarURL) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Nicht angemeldet');
        }

        // Extract path from URL or use directly
        let avatarRef;
        if (avatarURL.startsWith('http')) {
            avatarRef = firebase.storage().refFromURL(avatarURL);
        } else {
            avatarRef = firebase.storage().ref(avatarURL);
        }

        // Delete file
        await avatarRef.delete();
        console.log('✅ Avatar deleted');

    } catch (error) {
        console.error('❌ Delete failed:', error);

        if (error.code === 'storage/object-not-found') {
            console.warn('⚠️ File already deleted');
            return; // Not an error
        } else if (error.code === 'storage/unauthorized') {
            throw new Error('Keine Berechtigung zum Löschen');
        }

        throw error;
    }
}

// ===================================
// ✅ UI INTEGRATION EXAMPLE
// ===================================

/**
 * Example: Setup avatar upload UI
 */
function setupAvatarUpload() {
    const fileInput = document.getElementById('avatar-input');
    const uploadBtn = document.getElementById('upload-avatar-btn');
    const progressBar = document.getElementById('upload-progress');
    const avatarImg = document.getElementById('user-avatar');

    if (!fileInput || !uploadBtn) {
        console.warn('Avatar upload elements not found');
        return;
    }

    uploadBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            alert('Bitte wähle ein Bild aus');
            return;
        }

        try {
            // Show loading state
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Wird hochgeladen...';
            if (progressBar) {
                progressBar.style.display = 'block';
                progressBar.value = 0;
            }

            // Upload with progress
            const downloadURL = await uploadAvatar(file, (progress) => {
                if (progressBar) {
                    progressBar.value = progress;
                }
            });

            // Update UI
            if (avatarImg) {
                avatarImg.src = downloadURL;
            }

            // Show success
            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Avatar erfolgreich hochgeladen!',
                    'success',
                    3000
                );
            } else {
                alert('Avatar erfolgreich hochgeladen!');
            }

            // Save URL to database (optional)
            // await saveAvatarURLToDatabase(downloadURL);

        } catch (error) {
            console.error('Upload failed:', error);

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    error.message || 'Upload fehlgeschlagen',
                    'error',
                    5000
                );
            } else {
                alert(error.message || 'Upload fehlgeschlagen');
            }

        } finally {
            // Reset UI
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Avatar hochladen';
            if (progressBar) {
                progressBar.style.display = 'none';
            }
        }
    });
}

// ===================================
// ✅ AUTO-INIT
// ===================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAvatarUpload);
} else {
    setupAvatarUpload();
}

// ===================================
// EXPORT FOR MODULE USAGE
// ===================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        uploadAvatar,
        deleteAvatar,
        validateAvatarFile,
        optimizeImage
    };
}

