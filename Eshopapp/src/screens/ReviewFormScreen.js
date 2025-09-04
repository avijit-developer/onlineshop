import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import { useRoute, useNavigation } from '@react-navigation/native';
import api from '../utils/api';

export default function ReviewFormScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { productId, productName } = route.params || {};
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!productId) return;
    if (!rating) return Alert.alert('Validation', 'Please select a rating');
    if (!comment.trim()) return Alert.alert('Validation', 'Please write your review');
    try {
      setSubmitting(true);
      const res = await api.submitProductReview(productId, { rating, title, comment });
      if (res?.success) {
        Alert.alert('Thank you!', 'Your review has been submitted and awaits approval.');
        navigation.goBack();
      } else {
        Alert.alert('Error', res?.message || 'Failed to submit review');
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <AntDesign name="arrowleft" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Write a Review</Text>
        <View style={{ width: 22 }} />
      </View>

      <Text style={styles.productName} numberOfLines={2}>{productName || 'Product'}</Text>

      <Text style={styles.label}>Your Rating</Text>
      <View style={styles.starsRow}>
        {[1,2,3,4,5].map(star => (
          <TouchableOpacity key={star} onPress={() => setRating(star)}>
            <AntDesign name={star <= rating ? 'star' : 'staro'} size={28} color={star <= rating ? '#FFC107' : '#C7C7C7'} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Title (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Summarize your review"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Your Review</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Share your experience..."
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={5}
      />

      <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={submit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Review</Text>}
      </TouchableOpacity>
    </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  productName: { fontSize: 14, color: '#333', marginBottom: 16 },
  label: { fontSize: 14, color: '#000', marginTop: 12, marginBottom: 6, fontWeight: '600' },
  starsRow: { flexDirection: 'row', gap: 8 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#000' },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#f7ab18', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

