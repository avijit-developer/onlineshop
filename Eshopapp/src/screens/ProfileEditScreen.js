import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  TextInput,
  Platform,
  PermissionsAndroid,
  ToastAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../contexts/UserContext';
// import ImagePicker from 'react-native-image-crop-picker';

const ProfileEditScreen = () => {
  const navigation = useNavigation();
  const { user, updateUser } = useUser();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatar: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState({});

  // Initialize form data when component mounts
  useEffect(() => {
    if (user) {
      const names = (user.name || '').split(' ');
      setFormData({
        firstName: names[0] || '',
        lastName: names.slice(1).join(' ') || '',
        email: user.email || '',
        phone: user.phone || '',
        avatar: user.avatar || null,
      });
    }
  }, [user]);

  // Render avatar or initials fallback
  const renderAvatar = () => {
    const uri = formData.avatar || user?.avatar;
    if (uri) {
      return <Image source={{ uri }} style={styles.avatar} />;
    }
    const name = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    const [first, last] = (name || '').split(' ');
    const initials = `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || 'U';
    return (
      <View style={[styles.avatar, { backgroundColor: '#fde68a', alignItems: 'center', justifyContent: 'center' }]}> 
        <Text style={{ color: '#92400e', fontWeight: '800', fontSize: 28 }}>{initials}</Text>
      </View>
    );
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (formData.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Phone number is invalid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        // For Android 13+ (API level 33+), use READ_MEDIA_IMAGES
        // For older versions, use READ_EXTERNAL_STORAGE
        const permission = Platform.Version >= 33 
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

        const granted = await PermissionsAndroid.request(
          permission,
          {
            title: 'Storage Permission',
            message: 'App needs access to your photos to select profile pictures.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs access to your camera to take profile pictures.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const handleImagePick = async () => {
    Alert.alert(
      'Select Profile Picture',
      'Choose how you want to add a profile picture',
      [
        {
          text: 'Camera',
          onPress: async () => {
            try {
              const hasPermission = await requestCameraPermission();
              if (!hasPermission) {
                Alert.alert(
                  'Permission Required',
                  'Sorry, we need camera permissions to take profile pictures!',
                  [{ text: 'OK' }]
                );
                return;
              }

              // const result = await ImagePicker.openCamera({
              //   width: 800,
              //   height: 800,
              //   cropping: true,
              //   cropperCircleOverlay: true,
              //   compressImageMaxWidth: 800,
              //   compressImageMaxHeight: 800,
              //   compressImageQuality: 0.8,
              //   includeBase64: false,
              //   saveToPhotos: true,
              // });

              // setFormData(prev => ({
              //   ...prev,
              //   avatar: result.path,
              //   selectedImageFile: {
              //     uri: result.path,
              //     type: result.mime || 'image/jpeg',
              //     name: result.filename || 'profile.jpg'
              //   }
              // }));
            } catch (error) {
              console.error('Error taking photo:', error);
              if (error.code !== 'E_PICKER_CANCELLED') {
                Alert.alert('Error', 'Failed to take photo. Please try again.');
              }
            }
          }
        },
        {
          text: 'Gallery',
          onPress: async () => {
            try {
              const result = await ImagePicker.openPicker({
                width: 800,
                height: 800,
                cropping: true,
                cropperCircleOverlay: true,
                compressImageMaxWidth: 800,
                compressImageMaxHeight: 800,
                compressImageQuality: 0.8,
                includeBase64: false,
                mediaType: 'photo',
              });

              setFormData(prev => ({
                ...prev,
                avatar: result.path,
                selectedImageFile: {
                  uri: result.path,
                  type: result.mime || 'image/jpeg',
                  name: result.filename || 'profile.jpg'
                }
              }));
            } catch (error) {
              console.error('Error picking image:', error);
              if (error.code !== 'E_PICKER_CANCELLED') {
                Alert.alert('Error', 'Failed to pick image. Please try again.');
              }
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const updatedUserData = {
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
      };

      // If there's a new image selected, upload it first
      if (formData.selectedImageFile) {
        try {
          const uploadResult = await updateUser({ ...updatedUserData, selectedImageFile: formData.selectedImageFile });
          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Failed to upload profile picture');
          }
        } catch (uploadError) {
          console.log('Error uploading image:', uploadError);
          Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
          return;
        }
      } else {
        // Update profile without image
        const result = await updateUser(updatedUserData);
        if (!result.success) {
          throw new Error(result.error || 'Failed to update profile');
        }
      }
      
      if (Platform.OS === 'android') {
        ToastAndroid.show('Profile updated successfully', ToastAndroid.SHORT);
        navigation.goBack();
      } else {
        setNotice('Profile updated successfully');
        setTimeout(() => { setNotice(''); navigation.goBack(); }, 1000);
      }
    } catch (error) {
      console.log('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Discard Changes',
      'Are you sure you want to discard your changes?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
      ]
    );
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity 
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {notice ? (
          <View style={styles.noticeBar}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
        {/* Profile Picture Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleImagePick}>
            {renderAvatar()}
            <View style={styles.avatarOverlay}>
              <Icon name="camera" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarText}>Tap to change photo</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          {/* First Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name *</Text>
            <TextInput
              style={[styles.input, errors.firstName && styles.inputError]}
              value={formData.firstName}
              onChangeText={(value) => updateField('firstName', value)}
              placeholder="Enter first name"
              placeholderTextColor="#999"
            />
            {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
          </View>

          {/* Last Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={formData.lastName}
              onChangeText={(value) => updateField('lastName', value)}
              placeholder="Enter last name"
              placeholderTextColor="#999"
            />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email *</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              placeholder="Enter email address"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              placeholder="Enter phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButtonLarge, isLoading && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonLargeText}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#f7ab18',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  noticeBar: {
    backgroundColor: '#e8f5e9',
    borderColor: '#c8e6c9',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 4,
    alignSelf: 'center',
  },
  noticeText: { color: '#2e7d32', fontWeight: '700' },
  avatarSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#f7ab18',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#f7ab18',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  saveButtonLarge: {
    backgroundColor: '#f7ab18',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 30,
  },
  saveButtonLargeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ProfileEditScreen;