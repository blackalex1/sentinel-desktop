package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

// StorageManager manages persistent local data in binaries/ or user AppData.
type StorageManager struct {
	mu      sync.RWMutex
	baseDir string
	key     []byte
}

var (
	storageInstance *StorageManager
	storageOnce     sync.Once
)

// GetStorage returns the singleton StorageManager instance.
func GetStorage() *StorageManager {
	storageOnce.Do(func() {
		// Generate machine-bound key
		h := sha256.New()
		h.Write([]byte("SentinelSecure-Desktop-Vault-2026"))
		if hostname, err := os.Hostname(); err == nil {
			h.Write([]byte(hostname))
		}
		storageInstance = &StorageManager{
			key: h.Sum(nil),
		}
	})
	return storageInstance
}

// Init sets the storage base directory.
func (s *StorageManager) Init(baseDir string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.baseDir = baseDir
}

func (s *StorageManager) getFilePath(key string) string {
	dir := filepath.Join(s.baseDir, "binaries")
	_ = os.MkdirAll(dir, 0755)
	return filepath.Join(dir, fmt.Sprintf("%s.bin", key))
}

// SaveData saves data to disk with AES-GCM encryption.
func (s *StorageManager) SaveData(key string, plainText string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	filePath := s.getFilePath(key)

	block, err := aes.NewCipher(s.key)
	if err != nil {
		return false
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return false
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return false
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plainText), nil)
	hexData := hex.EncodeToString(ciphertext)

	if err := os.WriteFile(filePath, []byte(hexData), 0600); err != nil {
		return false
	}
	return true
}

// ReadData reads and decrypts data from disk.
func (s *StorageManager) ReadData(key string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filePath := s.getFilePath(key)
	data, err := os.ReadFile(filePath)
	if err != nil || len(data) == 0 {
		// Check fallback unencrypted json if exists
		jsonPath := filepath.Join(s.baseDir, "binaries", fmt.Sprintf("%s.json", key))
		if jd, err := os.ReadFile(jsonPath); err == nil {
			return string(jd)
		}
		return ""
	}

	rawCipher, err := hex.DecodeString(string(data))
	if err != nil {
		// Might be plain json
		return string(data)
	}

	block, err := aes.NewCipher(s.key)
	if err != nil {
		return string(data)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return string(data)
	}

	nonceSize := gcm.NonceSize()
	if len(rawCipher) < nonceSize {
		return string(data)
	}

	nonce, ciphertext := rawCipher[:nonceSize], rawCipher[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return string(data)
	}

	return string(plaintext)
}
