import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Vendors.css';
import defaultVendor from '../../assets/default-vendor.png';
import { getCurrencySettings } from '../../utils/currency';

const ORIGIN = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
const API_BASE = process.env.REACT_APP_API_URL || (ORIGIN && ORIGIN.includes('localhost:3000') ? 'http://localhost:5000' : (ORIGIN || 'http://localhost:5000'));

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [rowAction, setRowAction] = useState({});
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  // Get current user and permissions
  const getCurrentUser = () => {
    const userData = localStorage.getItem('adminUser');
    return userData ? JSON.parse(userData) : null;
  };

  const currentUser = getCurrentUser();
  const userPerms = new Set(currentUser?.permissions || []);
  const isVendor = currentUser?.role === 'vendor';
  const isAdmin = currentUser?.role === 'admin';
  const has = (perm) => isAdmin || userPerms.has('*') || userPerms.has(perm);

  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    zip: '',
    address: '',
    // commission field removed per new logic; keep placeholder for backend compatibility if needed
    commission: undefined,
    logoPreview: '',
    bankAccountHolderName: '',
    bankAccountNumber: '',
    bankName: '',
    bankIFSC: '',
    bankBranch: '',
    panCardPreview: '',
    aadharCardPreview: '',
    bankDetailsDocumentPreview: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [panCardFile, setPanCardFile] = useState(null);
  const [aadharCardFile, setAadharCardFile] = useState(null);
  const [bankDetailsDocumentFile, setBankDetailsDocumentFile] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  };
  const getAuthHeaderOnly = () => {
    const token = localStorage.getItem('adminToken');
    return {
      Authorization: token ? `Bearer ${token}` : ''
    };
  };

  const formatAddress = (v) => {
    if (!v) return '';
    const parts = [v.address1, v.address2, v.city, v.zip]
      .map((s) => (s || '').trim())
      .filter(Boolean);
    return parts.join(', ');
  };

  useEffect(() => {
    // Load currency symbol from settings
    const currencySettings = getCurrencySettings();
    setCurrencySymbol(currencySettings.currencySymbol || '₹');
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [currentPage, itemsPerPage, searchTerm, statusFilter]);

  // Function to refresh user permissions
  const refreshUserPermissions = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE}/api/v1/auth/current-permissions`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('🔄 VENDORS: Refreshed permissions:', data.permissions);
        
        // Update localStorage with new permissions
        const currentUser = getCurrentUser();
        const updatedUser = { ...currentUser, permissions: data.permissions };
        localStorage.setItem('adminUser', JSON.stringify(updatedUser));
        
        // Reload the page to apply new permissions
        window.location.reload();
        
        toast.success('Permissions refreshed!');
      } else {
        toast.error('Failed to refresh permissions');
      }
    } catch (error) {
      console.error('Error refreshing permissions:', error);
      toast.error('Failed to refresh permissions');
    }
  };

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const q = searchTerm ? `&q=${encodeURIComponent(searchTerm)}` : '';
      const status = statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : '';
      
      console.log('Fetching vendors with user:', currentUser);
      console.log('User permissions:', userPerms);
      
      const res = await fetch(`${API_BASE}/api/v1/vendors?page=${currentPage}&limit=${itemsPerPage}${status}${q}`, {
        headers: getAuthHeaders()
      });
      const json = await res.json();
      
      console.log('Vendors API response:', { status: res.status, ok: res.ok, data: json });
      
      if (!res.ok) throw new Error(json?.message || 'Failed to load vendors');
      setVendors(json.data || []);
      setTotal(json?.meta?.total || 0);
      const pagesCount = Math.max(1, Math.ceil((json?.meta?.total || 0) / itemsPerPage));
      if (currentPage > pagesCount) setCurrentPage(pagesCount);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error(error.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (vendorId, newStatus) => {
    try {
      setRowAction(prev => ({ ...prev, [vendorId]: newStatus }));
      setVendors(prev => prev.map(v => {
        const id = v._id || v.id;
        if (String(id) !== String(vendorId)) return v;
        return { ...v, status: newStatus, enabled: newStatus === 'approved' ? true : v.enabled };
      }));
      const res = await fetch(`${API_BASE}/api/v1/vendors/${vendorId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update status');
      toast.success(`Vendor ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully`);
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to update vendor status');
      fetchVendors();
    } finally {
      setRowAction(prev => { const { [vendorId]: _, ...rest } = prev; return rest; });
    }
  };

  const handleEnableToggle = async (vendor, enabled) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/vendors/${vendor._id || vendor.id}/enable`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update enable status');
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to update vendor status');
    }
  };

  const viewProfile = (vendor) => {
    setSelectedVendor(vendor);
    setShowProfileModal(true);
  };

  const getUploadSignature = async (subfolder, resourceType = 'auto') => {
    const res = await fetch(`${API_BASE}/api/v1/uploads/signature`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: subfolder, resource_type: resourceType })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || 'Failed to get upload signature');
    return json.data; // includes cloudName and apiKey
  };

  const uploadToCloudinary = async (file, subfolder = 'vendors') => {
    try {
      // Determine resource type based on file type
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const resourceType = isPDF ? 'raw' : 'image'; // Use 'raw' for PDF, 'image' for images
      
      // Get signature with resource_type parameter
      const { signature, timestamp, folder, apiKey, cloudName } = await getUploadSignature(subfolder, resourceType);
      
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', apiKey);
      fd.append('timestamp', String(timestamp));
      fd.append('signature', signature);
      fd.append('folder', folder);
      fd.append('unique_filename', 'true');
      fd.append('overwrite', 'false');
      fd.append('resource_type', resourceType);
      fd.append('type', 'upload'); // Ensure public access
      
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
        method: 'POST',
        body: fd
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        console.error('Cloudinary upload error:', json);
        throw new Error(json?.error?.message || 'Cloudinary upload failed');
      }
      
      // Check if secure_url exists
      if (!json.secure_url) {
        console.error('Cloudinary response missing secure_url:', json);
        throw new Error('Upload successful but URL not returned');
      }
      
      console.log('Cloudinary upload success:', {
        secure_url: json.secure_url,
        public_id: json.public_id,
        resource_type: json.resource_type,
        format: json.format,
        url: json.url,
        bytes: json.bytes
      });
      
      // For raw files (PDFs), Cloudinary returns secure_url
      // But we need to ensure the URL is accessible
      let finalUrl = json.secure_url || json.url;
      
      if (!finalUrl) {
        // If no URL in response, construct it manually for raw files
        if (resourceType === 'raw' && json.public_id) {
          finalUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${json.public_id}`;
          console.log('Constructed raw URL:', finalUrl);
        } else {
          throw new Error('No URL returned from Cloudinary');
        }
      }
      
      // Verify URL format for raw files
      if (resourceType === 'raw' && !finalUrl.includes('/raw/upload/')) {
        console.warn('Raw file URL may be incorrect. Expected format: .../raw/upload/...');
        console.warn('Actual URL:', finalUrl);
      }
      
      return { imageUrl: finalUrl, imagePublicId: json.public_id };
    } catch (error) {
      console.error('Upload to Cloudinary failed:', error);
      throw error;
    }
  };

  const handleOpenAdd = () => {
    setFormData({ name: '', companyName: '', email: '', phone: '', address1: '', address2: '', city: '', zip: '', address: '', commission: undefined, logoPreview: '', bankAccountHolderName: '', bankAccountNumber: '', bankName: '', bankIFSC: '', bankBranch: '', panCardPreview: '', aadharCardPreview: '', bankDetailsDocumentPreview: '' });
    setImageFile(null);
    setPanCardFile(null);
    setAadharCardFile(null);
    setBankDetailsDocumentFile(null);
    setShowAddModal(true);
  };

  const handleAddInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setFormData(prev => ({ ...prev, logoPreview: URL.createObjectURL(file) }));
    }
  };

  // Helper function to check if URL is PDF
  const isPDFUrl = (url) => {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return urlLower.includes('.pdf') || urlLower.includes('/pdf/') || urlLower.endsWith('#pdf');
  };

  // Helper function to open PDF in new tab
  const openPDFInNewTab = async (url) => {
    try {
      const cleanUrl = url.replace('#pdf', '').trim();
      
      if (!cleanUrl) {
        toast.error('Invalid file URL');
        return;
      }
      
      console.log('Opening PDF URL:', cleanUrl);
      
      // Try multiple approaches for maximum compatibility
      
      // Approach 1: Try Google Docs Viewer (works for most public URLs)
      const encodedUrl = encodeURIComponent(cleanUrl);
      const viewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
      
      // Open in new tab
      let newWindow = window.open(viewerUrl, '_blank');
      
      if (newWindow) {
        toast.success('Opening PDF in viewer...');
        // Give it a moment, if it fails, try direct URL
        setTimeout(() => {
          try {
            if (newWindow.closed) {
              // Viewer failed, try direct URL
              console.log('Viewer closed, trying direct URL...');
              window.open(cleanUrl, '_blank');
            }
          } catch (e) {
            // Cross-origin check, but window exists, so likely working
          }
        }, 1000);
      } else {
        // Popup blocked, try direct URL
        toast.error('Popup blocked. Trying direct URL...');
        window.open(cleanUrl, '_blank');
      }
      
    } catch (error) {
      console.error('Open PDF failed:', error);
      toast.error(`Failed to open PDF: ${error.message}. Please use Download button.`);
    }
  };

  // Helper function to download file
  const downloadFile = async (url, filename) => {
    try {
      // Clean URL (remove #pdf flag if present)
      const cleanUrl = url.replace('#pdf', '').trim();
      
      if (!cleanUrl) {
        toast.error('Invalid file URL');
        return;
      }
      
      // For Cloudinary raw/PDF URLs, we need to use fetch and create blob
      if (cleanUrl.includes('cloudinary.com') && cleanUrl.includes('/raw/upload/')) {
        // Fetch the PDF file
        const response = await fetch(cleanUrl, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Get blob
        const blob = await response.blob();
        
        // Check if blob is valid
        if (blob.size === 0) {
          throw new Error('Downloaded file is empty');
        }
        
        // Create download link
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      } else {
        // For non-Cloudinary URLs or images, use direct download
        const link = document.createElement('a');
        link.href = cleanUrl;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
        }, 100);
      }
      
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed. Opening in new tab...');
      // Fallback: open in new tab
      const cleanUrl = url.replace('#pdf', '').trim();
      window.open(cleanUrl, '_blank');
    }
  };

  const handlePanCardChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPanCardFile(file);
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, panCardPreview: isPDF ? previewUrl + '#pdf' : previewUrl }));
    }
  };

  const handleAadharCardChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAadharCardFile(file);
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, aadharCardPreview: isPDF ? previewUrl + '#pdf' : previewUrl }));
    }
  };

  const handleBankDetailsDocumentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBankDetailsDocumentFile(file);
      const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, bankDetailsDocumentPreview: isPDF ? previewUrl + '#pdf' : previewUrl }));
    }
  };

  const submitAddVendor = async (e) => {
    e.preventDefault();
    try {
      if (addSubmitting) return;
      setAddSubmitting(true);
      if (!formData.name.trim() || !formData.companyName.trim() || !formData.email.trim()) {
        toast.error('Name, Company and Email are required');
        setAddSubmitting(false);
        return;
      }
      if (!panCardFile) {
        toast.error('PAN Card upload is required');
        setAddSubmitting(false);
        return;
      }
      if (!aadharCardFile) {
        toast.error('Aadhar Card upload is required');
        setAddSubmitting(false);
        return;
      }
      if (!formData.bankAccountHolderName.trim() || !formData.bankAccountNumber.trim() || !formData.bankName.trim() || !formData.bankIFSC.trim()) {
        toast.error('Bank details are required (Account Holder Name, Account Number, Bank Name, IFSC Code)');
        setAddSubmitting(false);
        return;
      }
      if (!bankDetailsDocumentFile) {
        toast.error('Bank Details Document upload is required');
        setAddSubmitting(false);
        return;
      }
      let payload = {
        name: formData.name.trim(),
        companyName: formData.companyName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address1: formData.address1.trim(),
        address2: formData.address2.trim(),
        city: formData.city.trim(),
        zip: formData.zip.trim(),
        address: formData.address.trim(),
        // commission removed; do not send unless explicitly set
        bankAccountHolderName: formData.bankAccountHolderName.trim(),
        bankAccountNumber: formData.bankAccountNumber.trim(),
        bankName: formData.bankName.trim(),
        bankIFSC: formData.bankIFSC.trim(),
        bankBranch: formData.bankBranch.trim()
      };
      if (imageFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(imageFile, 'vendors');
        payload.imageUrl = imageUrl;
        payload.imagePublicId = imagePublicId;
      }
      // Upload PAN card
      if (panCardFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(panCardFile, 'vendors/documents');
        payload.panCard = imageUrl;
        payload.panCardPublicId = imagePublicId;
        // Update preview with uploaded URL, preserve PDF flag if it's a PDF
        const isPDF = panCardFile.type === 'application/pdf' || panCardFile.name.toLowerCase().endsWith('.pdf');
        setFormData(prev => ({ ...prev, panCardPreview: isPDF ? imageUrl + '#pdf' : imageUrl }));
      }
      // Upload Aadhar card
      if (aadharCardFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(aadharCardFile, 'vendors/documents');
        payload.aadharCard = imageUrl;
        payload.aadharCardPublicId = imagePublicId;
        // Update preview with uploaded URL, preserve PDF flag if it's a PDF
        const isPDF = aadharCardFile.type === 'application/pdf' || aadharCardFile.name.toLowerCase().endsWith('.pdf');
        setFormData(prev => ({ ...prev, aadharCardPreview: isPDF ? imageUrl + '#pdf' : imageUrl }));
      }
      // Upload Bank Details Document
      if (bankDetailsDocumentFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(bankDetailsDocumentFile, 'vendors/documents');
        payload.bankDetailsDocument = imageUrl;
        payload.bankDetailsDocumentPublicId = imagePublicId;
        // Update preview with uploaded URL, preserve PDF flag if it's a PDF
        const isPDF = bankDetailsDocumentFile.type === 'application/pdf' || bankDetailsDocumentFile.name.toLowerCase().endsWith('.pdf');
        setFormData(prev => ({ ...prev, bankDetailsDocumentPreview: isPDF ? imageUrl + '#pdf' : imageUrl }));
      }
      const res = await fetch(`${API_BASE}/api/v1/vendors`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to add vendor');
      toast.success('Vendor added successfully');
      setShowAddModal(false);
      setImageFile(null);
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to add vendor');
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEdit = (vendor) => {
    setSelectedVendor(vendor);
    setFormData({
      name: vendor.name || '',
      companyName: vendor.companyName || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address1: vendor.address1 || '',
      address2: vendor.address2 || '',
      city: vendor.city || '',
      zip: vendor.zip || '',
      address: vendor.address || '',
      commission: undefined,
      logoPreview: vendor.logo || '',
      bankAccountHolderName: vendor.bankAccountHolderName || '',
      bankAccountNumber: vendor.bankAccountNumber || '',
      bankName: vendor.bankName || '',
      bankIFSC: vendor.bankIFSC || '',
      bankBranch: vendor.bankBranch || '',
      panCardPreview: vendor.panCard ? (isPDFUrl(vendor.panCard) ? vendor.panCard + '#pdf' : vendor.panCard) : '',
      aadharCardPreview: vendor.aadharCard ? (isPDFUrl(vendor.aadharCard) ? vendor.aadharCard + '#pdf' : vendor.aadharCard) : '',
      bankDetailsDocumentPreview: vendor.bankDetailsDocument ? (isPDFUrl(vendor.bankDetailsDocument) ? vendor.bankDetailsDocument + '#pdf' : vendor.bankDetailsDocument) : ''
    });
    setImageFile(null);
    setPanCardFile(null);
    setAadharCardFile(null);
    setBankDetailsDocumentFile(null);
    setShowEditModal(true);
  };

  const submitEditVendor = async (e) => {
    e.preventDefault();
    try {
      if (editSubmitting) return;
      setEditSubmitting(true);
      const vendorId = selectedVendor?._id || selectedVendor?.id;
      if (!vendorId) throw new Error('No vendor selected');
      if (!formData.name.trim() || !formData.companyName.trim() || !formData.email.trim()) {
        toast.error('Name, Company and Email are required');
        setEditSubmitting(false);
        return;
      }
      // For edit, check if PAN card exists or new file is uploaded
      if (!selectedVendor.panCard && !panCardFile) {
        toast.error('PAN Card upload is required');
        setEditSubmitting(false);
        return;
      }
      // For edit, check if Aadhar card exists or new file is uploaded
      if (!selectedVendor.aadharCard && !aadharCardFile) {
        toast.error('Aadhar Card upload is required');
        setEditSubmitting(false);
        return;
      }
      if (!formData.bankAccountHolderName.trim() || !formData.bankAccountNumber.trim() || !formData.bankName.trim() || !formData.bankIFSC.trim()) {
        toast.error('Bank details are required (Account Holder Name, Account Number, Bank Name, IFSC Code)');
        setEditSubmitting(false);
        return;
      }
      // For edit, check if bank details document exists or new file is uploaded
      if (!selectedVendor.bankDetailsDocument && !bankDetailsDocumentFile) {
        toast.error('Bank Details Document upload is required');
        setEditSubmitting(false);
        return;
      }
      let payload = {
        name: formData.name.trim(),
        companyName: formData.companyName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address1: formData.address1.trim(),
        address2: formData.address2.trim(),
        city: formData.city.trim(),
        zip: formData.zip.trim(),
        address: formData.address.trim(),
        // commission removed; do not send unless explicitly set
        bankAccountHolderName: formData.bankAccountHolderName.trim(),
        bankAccountNumber: formData.bankAccountNumber.trim(),
        bankName: formData.bankName.trim(),
        bankIFSC: formData.bankIFSC.trim(),
        bankBranch: formData.bankBranch.trim()
      };
      if (imageFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(imageFile, 'vendors');
        payload.imageUrl = imageUrl;
        payload.imagePublicId = imagePublicId;
      }
      // Upload PAN card if new file is provided
      if (panCardFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(panCardFile, 'vendors/documents');
        payload.panCard = imageUrl;
        payload.panCardPublicId = imagePublicId;
        // Update preview with uploaded URL, preserve PDF flag if it's a PDF
        const isPDF = panCardFile.type === 'application/pdf' || panCardFile.name.toLowerCase().endsWith('.pdf');
        setFormData(prev => ({ ...prev, panCardPreview: isPDF ? imageUrl + '#pdf' : imageUrl }));
      }
      // Upload Aadhar card if new file is provided
      if (aadharCardFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(aadharCardFile, 'vendors/documents');
        payload.aadharCard = imageUrl;
        payload.aadharCardPublicId = imagePublicId;
        // Update preview with uploaded URL, preserve PDF flag if it's a PDF
        const isPDF = aadharCardFile.type === 'application/pdf' || aadharCardFile.name.toLowerCase().endsWith('.pdf');
        setFormData(prev => ({ ...prev, aadharCardPreview: isPDF ? imageUrl + '#pdf' : imageUrl }));
      }
      // Upload Bank Details Document if new file is provided
      if (bankDetailsDocumentFile) {
        const { imageUrl, imagePublicId } = await uploadToCloudinary(bankDetailsDocumentFile, 'vendors/documents');
        payload.bankDetailsDocument = imageUrl;
        payload.bankDetailsDocumentPublicId = imagePublicId;
        // Update preview with uploaded URL, preserve PDF flag if it's a PDF
        const isPDF = bankDetailsDocumentFile.type === 'application/pdf' || bankDetailsDocumentFile.name.toLowerCase().endsWith('.pdf');
        setFormData(prev => ({ ...prev, bankDetailsDocumentPreview: isPDF ? imageUrl + '#pdf' : imageUrl }));
      }
      const res = await fetch(`${API_BASE}/api/v1/vendors/${vendorId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to update vendor');
      toast.success('Vendor updated successfully');
      setShowEditModal(false);
      setImageFile(null);
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to update vendor');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteVendor = async (vendor) => {
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/vendors/${vendor._id || vendor.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || 'Failed to delete vendor');
      toast.success('Vendor deleted');
      fetchVendors();
    } catch (error) {
      toast.error(error.message || 'Failed to delete vendor');
    }
  };

  const pagesCount = Math.max(1, Math.ceil(total / itemsPerPage));

  if (loading) {
    return <div className="loading">Loading vendors...</div>;
  }

  return (
    <div className="vendors-container">
      <div className="page-header">
        <h1>Vendor Management</h1>
        <div className="header-actions">
          <div className="view-toggle">
            {has('vendor.add') && (
              <button className="btn btn-primary" onClick={handleOpenAdd}>Add Vendor</button>
            )}
            {isVendor && (
              <button className="btn btn-secondary" onClick={refreshUserPermissions} title="Refresh permissions">
                🔄 Refresh Permissions
              </button>
            )}
          </div>
          <div className="search-filter-container">
            <div className="search-group">
              <input
                type="text"
                placeholder="Search vendors..."
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSearchTerm(pendingSearch.trim()); setCurrentPage(1); } }}
                className="search-input"
              />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="filter-select"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button className="btn btn-primary" onClick={() => { setSearchTerm(pendingSearch.trim()); setCurrentPage(1); }}>Search</button>
              {searchTerm && (
                <button className="btn btn-secondary" onClick={() => { setPendingSearch(''); setSearchTerm(''); setCurrentPage(1); }}>Clear</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Vendors</h3>
          <p>{total}</p>
        </div>
        <div className="stat-card">
          <h3>Pending Approval</h3>
          <p>{vendors.filter(v => v.status === 'pending').length}</p>
        </div>
        <div className="stat-card">
          <h3>Active Vendors</h3>
          <p>{vendors.filter(v => v.status === 'approved' && v.enabled).length}</p>
        </div>
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <p>{currencySymbol}{vendors.reduce((sum, v) => sum + (v.totalEarnings || 0), 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="vendors-table-container">
        <table className="vendors-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Enabled</th>
              {/* Commission removed */}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor._id || vendor.id}>
                <td>
                  <div className="vendor-info">
                    <img src={vendor.logo && vendor.logo.trim() ? vendor.logo : defaultVendor} alt={vendor.companyName} className="vendor-logo" />
                    <div>
                      <strong>{vendor.name}</strong>
                      <small>{vendor._id || vendor.id}</small>
                    </div>
                  </div>
                </td>
                <td>{vendor.companyName}</td>
                <td>{vendor.email}</td>
                <td>{vendor.phone}</td>
                <td>
                  <span className={`status-badge ${vendor.status}`}>
                    {vendor.status}
                  </span>
                </td>
                <td>
                  {has('vendor.edit') ? (
                    <label className="toggle-switch">
                      <input type="checkbox" checked={!!vendor.enabled} onChange={(e) => handleEnableToggle(vendor, e.target.checked)} />
                      <span className="slider" />
                    </label>
                  ) : (
                    <span>{vendor.enabled ? 'Yes' : 'No'}</span>
                  )}
                </td>
                {/* Commission removed from view */}
                <td>
                  <div className="action-buttons">
                    <button title="View" onClick={() => viewProfile(vendor)} className="btn btn-secondary btn-sm">👁️</button>
                    {vendor.status === 'pending' && !isVendor && has('vendor.approve') && (
                      <>
                        {rowAction[vendor._id || vendor.id] ? (
                          <span className="loading-inline">Updating...</span>
                        ) : (
                          <>
                            <button title="Approve" onClick={() => handleStatusChange(vendor._id || vendor.id, 'approved')} className="btn btn-success btn-sm">✔️</button>
                            <button title="Reject" onClick={() => handleStatusChange(vendor._id || vendor.id, 'rejected')} className="btn btn-danger btn-sm">✖️</button>
                          </>
                        )}
                      </>
                    )}
                    {has('vendor.edit') && (
                      <button title="Edit" onClick={() => openEdit(vendor)} className="btn btn-info btn-sm">✏️</button>
                    )}
                    {has('vendor.delete') && (
                      <button title="Delete" onClick={() => handleDeleteVendor(vendor)} className="btn btn-danger btn-sm">🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="btn btn-secondary">First</button>
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-secondary">Prev</button>
        <span className="page-info">Page {currentPage} of {Math.max(1, Math.ceil(total / itemsPerPage))}</span>
        <button onClick={() => setCurrentPage(p => Math.min(Math.max(1, Math.ceil(total / itemsPerPage)), p + 1))} disabled={currentPage >= Math.max(1, Math.ceil(total / itemsPerPage))} className="btn btn-secondary">Next</button>
        <button onClick={() => setCurrentPage(Math.max(1, Math.ceil(total / itemsPerPage)))} disabled={currentPage >= Math.max(1, Math.ceil(total / itemsPerPage))} className="btn btn-secondary">Last</button>
        <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="page-size-select" style={{ marginLeft: 8 }}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h2>Add Vendor</h2>
              <button onClick={() => setShowAddModal(false)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={submitAddVendor} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Company Name *</label>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Address 1 *</label>
                  <input type="text" name="address1" value={formData.address1} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Address 2</label>
                  <input type="text" name="address2" value={formData.address2} onChange={handleAddInput} />
                </div>
                <div className="form-group">
                  <label>City *</label>
                  <input type="text" name="city" value={formData.city} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>ZIP *</label>
                  <input type="text" name="zip" value={formData.zip} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Landmark / Additional Address Info</label>
                  <input type="text" name="address" value={formData.address} onChange={handleAddInput} placeholder="Landmark, notes" />
                </div>
                <div className="form-group full-width">
                  <h4 style={{ margin: '20px 0 10px 0', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>Bank Details *</h4>
                </div>
                <div className="form-group">
                  <label>Account Holder Name *</label>
                  <input type="text" name="bankAccountHolderName" value={formData.bankAccountHolderName} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Account Number *</label>
                  <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Bank Name *</label>
                  <input type="text" name="bankName" value={formData.bankName} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>IFSC Code *</label>
                  <input type="text" name="bankIFSC" value={formData.bankIFSC} onChange={handleAddInput} style={{ textTransform: 'uppercase' }} required />
                </div>
                <div className="form-group">
                  <label>Branch</label>
                  <input type="text" name="bankBranch" value={formData.bankBranch} onChange={handleAddInput} />
                </div>
                <div className="form-group full-width">
                  <h4 style={{ margin: '20px 0 10px 0', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>Documents *</h4>
                </div>
                <div className="form-group full-width">
                  <label>PAN Card * (Image or PDF)</label>
                  <input type="file" accept="image/*,.pdf" onChange={handlePanCardChange} />
                  {formData.panCardPreview && (
                    <div className="image-preview">
                      {isPDFUrl(formData.panCardPreview) ? (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <button onClick={() => downloadFile(formData.panCardPreview.replace('#pdf', ''), `PAN_Card_${formData.companyName || 'vendor'}.pdf`)} style={{ color: '#fff', background: '#28a745', border: '1px solid #28a745', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontWeight: '500' }}>⬇️ Download PDF</button>
                            <button onClick={() => openPDFInNewTab(formData.panCardPreview)} style={{ display: 'inline-block', color: '#007bff', background: 'white', padding: '8px 16px', border: '1px solid #007bff', borderRadius: '4px', textAlign: 'center', cursor: 'pointer' }}>📄 Try Open in Browser</button>
                          </div>
                          <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', background: '#f8f9fa' }}>
                            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}><strong>Note:</strong> PDF preview may not work due to browser security. Please use <strong>Download</strong> button to view the PDF file.</p>
                            <iframe 
                              src={`https://docs.google.com/viewer?url=${encodeURIComponent(formData.panCardPreview.replace('#pdf', ''))}&embedded=true`}
                              style={{ width: '100%', height: '500px', border: 'none', borderRadius: '4px' }}
                              title="PAN Card PDF Preview"
                              onError={(e) => {
                                console.error('PDF iframe error:', e);
                                const parent = e.target.parentNode;
                                parent.innerHTML = '<p style="padding: 20px; text-align: center; color: #dc3545; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">PDF preview not available. Please use <strong>Download</strong> button to view the PDF.</p>';
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <img src={formData.panCardPreview} alt="PAN Card preview" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px', border: '1px solid #ddd' }} />
                      )}
                    </div>
                  )}
                </div>
                <div className="form-group full-width">
                  <label>Aadhar Card * (Image or PDF)</label>
                  <input type="file" accept="image/*,.pdf" onChange={handleAadharCardChange} />
                  {formData.aadharCardPreview && (
                    <div className="image-preview">
                      {isPDFUrl(formData.aadharCardPreview) ? (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <button onClick={() => downloadFile(formData.aadharCardPreview.replace('#pdf', ''), `Aadhar_Card_${formData.companyName || 'vendor'}.pdf`)} style={{ color: '#fff', background: '#28a745', border: '1px solid #28a745', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontWeight: '500' }}>⬇️ Download PDF</button>
                            <button onClick={() => openPDFInNewTab(formData.aadharCardPreview)} style={{ display: 'inline-block', color: '#007bff', background: 'white', padding: '8px 16px', border: '1px solid #007bff', borderRadius: '4px', textAlign: 'center', cursor: 'pointer' }}>📄 Try Open in Browser</button>
                          </div>
                          <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', background: '#f8f9fa' }}>
                            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}><strong>Note:</strong> PDF preview may not work due to browser security. Please use <strong>Download</strong> button to view the PDF file.</p>
                            <iframe 
                              src={`https://docs.google.com/viewer?url=${encodeURIComponent(formData.aadharCardPreview.replace('#pdf', ''))}&embedded=true`}
                              style={{ width: '100%', height: '500px', border: 'none', borderRadius: '4px' }}
                              title="Aadhar Card PDF Preview"
                              onError={(e) => {
                                console.error('PDF iframe error:', e);
                                const parent = e.target.parentNode;
                                parent.innerHTML = '<p style="padding: 20px; text-align: center; color: #dc3545; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">PDF preview not available. Please use <strong>Download</strong> button to view the PDF.</p>';
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <img src={formData.aadharCardPreview} alt="Aadhar Card preview" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px', border: '1px solid #ddd' }} />
                      )}
                    </div>
                  )}
                </div>
                <div className="form-group full-width">
                  <label>Bank Details Document * (Image or PDF)</label>
                  <input type="file" accept="image/*,.pdf" onChange={handleBankDetailsDocumentChange} />
                  {formData.bankDetailsDocumentPreview && (
                    <div className="image-preview">
                      {isPDFUrl(formData.bankDetailsDocumentPreview) ? (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <button onClick={() => downloadFile(formData.bankDetailsDocumentPreview.replace('#pdf', ''), `Bank_Details_${formData.companyName || 'vendor'}.pdf`)} style={{ color: '#fff', background: '#28a745', border: '1px solid #28a745', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontWeight: '500' }}>⬇️ Download PDF</button>
                            <button onClick={() => openPDFInNewTab(formData.bankDetailsDocumentPreview)} style={{ display: 'inline-block', color: '#007bff', background: 'white', padding: '8px 16px', border: '1px solid #007bff', borderRadius: '4px', textAlign: 'center', cursor: 'pointer' }}>📄 Try Open in Browser</button>
                          </div>
                          <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', background: '#f8f9fa' }}>
                            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}><strong>Note:</strong> PDF preview may not work due to browser security. Please use <strong>Download</strong> button to view the PDF file.</p>
                            <iframe 
                              src={`https://docs.google.com/viewer?url=${encodeURIComponent(formData.bankDetailsDocumentPreview.replace('#pdf', ''))}&embedded=true`}
                              style={{ width: '100%', height: '500px', border: 'none', borderRadius: '4px' }}
                              title="Bank Details Document PDF Preview"
                              onError={(e) => {
                                console.error('PDF iframe error:', e);
                                const parent = e.target.parentNode;
                                parent.innerHTML = '<p style="padding: 20px; text-align: center; color: #dc3545; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">PDF preview not available. Please use <strong>Download</strong> button to view the PDF.</p>';
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <img src={formData.bankDetailsDocumentPreview} alt="Bank Details Document preview" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px', border: '1px solid #ddd' }} />
                      )}
                    </div>
                  )}
                </div>
                {/* Commission removed */}
                <div className="form-group full-width">
                  <label>Logo</label>
                  <input type="file" accept="image/*" onChange={handleLogoChange} />
                  {formData.logoPreview && (
                    <div className="image-preview">
                      <img src={(formData.logoPreview && formData.logoPreview.trim()) ? formData.logoPreview : defaultVendor} alt="Logo preview" />
                    </div>
                  )}
                </div>
              </div>
            </form>
            <div className="modal-footer">
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={submitAddVendor} className="btn btn-primary" disabled={addSubmitting}>{addSubmitting ? 'Saving...' : 'Add Vendor'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vendor Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h2>Edit Vendor</h2>
              <button onClick={() => setShowEditModal(false)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={submitEditVendor} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Company Name *</label>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Address 1 *</label>
                  <input type="text" name="address1" value={formData.address1} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Address 2</label>
                  <input type="text" name="address2" value={formData.address2} onChange={handleAddInput} />
                </div>
                <div className="form-group">
                  <label>City *</label>
                  <input type="text" name="city" value={formData.city} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>ZIP *</label>
                  <input type="text" name="zip" value={formData.zip} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Landmark / Additional Address Info</label>
                  <input type="text" name="address" value={formData.address} onChange={handleAddInput} placeholder="Landmark, notes" />
                </div>
                <div className="form-group full-width">
                  <h4 style={{ margin: '20px 0 10px 0', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>Bank Details *</h4>
                </div>
                <div className="form-group">
                  <label>Account Holder Name *</label>
                  <input type="text" name="bankAccountHolderName" value={formData.bankAccountHolderName} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Account Number *</label>
                  <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>Bank Name *</label>
                  <input type="text" name="bankName" value={formData.bankName} onChange={handleAddInput} required />
                </div>
                <div className="form-group">
                  <label>IFSC Code *</label>
                  <input type="text" name="bankIFSC" value={formData.bankIFSC} onChange={handleAddInput} style={{ textTransform: 'uppercase' }} required />
                </div>
                <div className="form-group">
                  <label>Branch</label>
                  <input type="text" name="bankBranch" value={formData.bankBranch} onChange={handleAddInput} />
                </div>
                <div className="form-group full-width">
                  <h4 style={{ margin: '20px 0 10px 0', color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '8px' }}>Documents *</h4>
                </div>
                <div className="form-group full-width">
                  <label>PAN Card * (Image or PDF) {selectedVendor?.panCard && <span style={{ color: '#666', fontSize: '12px' }}>(Current file exists)</span>}</label>
                  <input type="file" accept="image/*,.pdf" onChange={handlePanCardChange} />
                  {formData.panCardPreview && (
                    <div className="image-preview">
                      {isPDFUrl(formData.panCardPreview) ? (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <button onClick={() => downloadFile(formData.panCardPreview.replace('#pdf', ''), `PAN_Card_${formData.companyName || 'vendor'}.pdf`)} style={{ color: '#fff', background: '#28a745', border: '1px solid #28a745', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontWeight: '500' }}>⬇️ Download PDF</button>
                            <button onClick={() => openPDFInNewTab(formData.panCardPreview)} style={{ display: 'inline-block', color: '#007bff', background: 'white', padding: '8px 16px', border: '1px solid #007bff', borderRadius: '4px', textAlign: 'center', cursor: 'pointer' }}>📄 Try Open in Browser</button>
                          </div>
                          <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', background: '#f8f9fa' }}>
                            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}><strong>Note:</strong> PDF preview may not work due to browser security. Please use <strong>Download</strong> button to view the PDF file.</p>
                            <iframe 
                              src={`https://docs.google.com/viewer?url=${encodeURIComponent(formData.panCardPreview.replace('#pdf', ''))}&embedded=true`}
                              style={{ width: '100%', height: '500px', border: 'none', borderRadius: '4px' }}
                              title="PAN Card PDF Preview"
                              onError={(e) => {
                                console.error('PDF iframe error:', e);
                                const parent = e.target.parentNode;
                                parent.innerHTML = '<p style="padding: 20px; text-align: center; color: #dc3545; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">PDF preview not available. Please use <strong>Download</strong> button to view the PDF.</p>';
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <img src={formData.panCardPreview} alt="PAN Card preview" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px', border: '1px solid #ddd' }} />
                      )}
                    </div>
                  )}
                </div>
                <div className="form-group full-width">
                  <label>Aadhar Card * (Image or PDF) {selectedVendor?.aadharCard && <span style={{ color: '#666', fontSize: '12px' }}>(Current file exists)</span>}</label>
                  <input type="file" accept="image/*,.pdf" onChange={handleAadharCardChange} />
                  {formData.aadharCardPreview && (
                    <div className="image-preview">
                      {isPDFUrl(formData.aadharCardPreview) ? (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <button onClick={() => downloadFile(formData.aadharCardPreview.replace('#pdf', ''), `Aadhar_Card_${formData.companyName || 'vendor'}.pdf`)} style={{ color: '#fff', background: '#28a745', border: '1px solid #28a745', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontWeight: '500' }}>⬇️ Download PDF</button>
                            <button onClick={() => openPDFInNewTab(formData.aadharCardPreview)} style={{ display: 'inline-block', color: '#007bff', background: 'white', padding: '8px 16px', border: '1px solid #007bff', borderRadius: '4px', textAlign: 'center', cursor: 'pointer' }}>📄 Try Open in Browser</button>
                          </div>
                          <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', background: '#f8f9fa' }}>
                            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}><strong>Note:</strong> PDF preview may not work due to browser security. Please use <strong>Download</strong> button to view the PDF file.</p>
                            <iframe 
                              src={`https://docs.google.com/viewer?url=${encodeURIComponent(formData.aadharCardPreview.replace('#pdf', ''))}&embedded=true`}
                              style={{ width: '100%', height: '500px', border: 'none', borderRadius: '4px' }}
                              title="Aadhar Card PDF Preview"
                              onError={(e) => {
                                console.error('PDF iframe error:', e);
                                const parent = e.target.parentNode;
                                parent.innerHTML = '<p style="padding: 20px; text-align: center; color: #dc3545; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">PDF preview not available. Please use <strong>Download</strong> button to view the PDF.</p>';
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <img src={formData.aadharCardPreview} alt="Aadhar Card preview" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px', border: '1px solid #ddd' }} />
                      )}
                    </div>
                  )}
                </div>
                <div className="form-group full-width">
                  <label>Bank Details Document * (Image or PDF) {selectedVendor?.bankDetailsDocument && <span style={{ color: '#666', fontSize: '12px' }}>(Current file exists)</span>}</label>
                  <input type="file" accept="image/*,.pdf" onChange={handleBankDetailsDocumentChange} />
                  {formData.bankDetailsDocumentPreview && (
                    <div className="image-preview">
                      {isPDFUrl(formData.bankDetailsDocumentPreview) ? (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <button onClick={() => downloadFile(formData.bankDetailsDocumentPreview.replace('#pdf', ''), `Bank_Details_${formData.companyName || 'vendor'}.pdf`)} style={{ color: '#fff', background: '#28a745', border: '1px solid #28a745', borderRadius: '4px', padding: '8px 16px', cursor: 'pointer', fontWeight: '500' }}>⬇️ Download PDF</button>
                            <button onClick={() => openPDFInNewTab(formData.bankDetailsDocumentPreview)} style={{ display: 'inline-block', color: '#007bff', background: 'white', padding: '8px 16px', border: '1px solid #007bff', borderRadius: '4px', textAlign: 'center', cursor: 'pointer' }}>📄 Try Open in Browser</button>
                          </div>
                          <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', background: '#f8f9fa' }}>
                            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}><strong>Note:</strong> PDF preview may not work due to browser security. Please use <strong>Download</strong> button to view the PDF file.</p>
                            <iframe 
                              src={`https://docs.google.com/viewer?url=${encodeURIComponent(formData.bankDetailsDocumentPreview.replace('#pdf', ''))}&embedded=true`}
                              style={{ width: '100%', height: '500px', border: 'none', borderRadius: '4px' }}
                              title="Bank Details Document PDF Preview"
                              onError={(e) => {
                                console.error('PDF iframe error:', e);
                                const parent = e.target.parentNode;
                                parent.innerHTML = '<p style="padding: 20px; text-align: center; color: #dc3545; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">PDF preview not available. Please use <strong>Download</strong> button to view the PDF.</p>';
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <img src={formData.bankDetailsDocumentPreview} alt="Bank Details Document preview" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '4px', border: '1px solid #ddd' }} />
                      )}
                    </div>
                  )}
                </div>
                {/* Commission removed */}
                <div className="form-group full-width">
                  <label>Logo</label>
                  <input type="file" accept="image/*" onChange={handleLogoChange} />
                  {formData.logoPreview && (
                    <div className="image-preview">
                      <img src={(formData.logoPreview && formData.logoPreview.trim()) ? formData.logoPreview : defaultVendor} alt="Logo preview" />
                    </div>
                  )}
                </div>
              </div>
            </form>
            <div className="modal-footer">
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={submitEditVendor} className="btn btn-primary" disabled={editSubmitting}>{editSubmitting ? 'Saving...' : 'Update Vendor'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && selectedVendor && (
        <div className="modal-overlay">
          <div className="modal profile-modal">
            <div className="modal-header">
              <h2>Vendor Profile</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {selectedVendor?.status === 'pending' && !isVendor && has('vendor.approve') && (
                  <button onClick={() => handleStatusChange(selectedVendor._id || selectedVendor.id, 'approved')} className="btn btn-success btn-sm">Approve</button>
                )}
                <button onClick={() => setShowProfileModal(false)} className="close-btn">&times;</button>
              </div>
            </div>
            <div className="modal-body">
              <div className="vendor-card">
                <div className="profile-hero">
                  <div className="cover" />
                  <div className="avatar-row">
                    <img
                      src={selectedVendor.logo && selectedVendor.logo.trim() ? selectedVendor.logo : defaultVendor}
                      alt={selectedVendor.companyName}
                      className="avatar"
                    />
                    <div className="title">
                      <h3 className="vendor-company">{selectedVendor.companyName}</h3>
                      <p className="vendor-name">{selectedVendor.name}</p>
                    </div>
                    <span className={`status-pill ${selectedVendor.status}`}>{selectedVendor.status}</span>
                  </div>
                </div>
                <div className="details-grid">
                  <div className="detail">
                    <span className="label">Email</span>
                    <span className="value">{selectedVendor.email || '—'}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Phone</span>
                    <span className="value">{selectedVendor.phone || '—'}</span>
                  </div>
                  <div className="detail full" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eef2f7' }}>
                    <span className="label" style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Address</span>
                  </div>
                  <div className="detail">
                    <span className="label">Address Line 1</span>
                    <span className="value">{selectedVendor.address1 || '—'}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Address Line 2</span>
                    <span className="value">{selectedVendor.address2 || '—'}</span>
                  </div>
                  <div className="detail">
                    <span className="label">City</span>
                    <span className="value">{selectedVendor.city || '—'}</span>
                  </div>
                  <div className="detail">
                    <span className="label">ZIP / PIN</span>
                    <span className="value">{selectedVendor.zip || '—'}</span>
                  </div>
                  <div className="detail full">
                    <span className="label">Landmark / Additional Address Info</span>
                    <span className="value">{selectedVendor.address || '—'}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Status</span>
                    <span className="value"><span className={`status-badge ${selectedVendor.status}`}>{selectedVendor.status}</span></span>
                  </div>
                  <div className="detail full" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eef2f7' }}>
                    <span className="label" style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Bank Details</span>
                  </div>
                  <div className="detail">
                    <span className="label">Account Holder</span>
                    <span className="value">{selectedVendor.bankAccountHolderName || '—'}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Account Number</span>
                    <span className="value">{selectedVendor.bankAccountNumber || '—'}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Bank Name</span>
                    <span className="value">{selectedVendor.bankName || '—'}</span>
                  </div>
                  <div className="detail">
                    <span className="label">IFSC Code</span>
                    <span className="value">{selectedVendor.bankIFSC || '—'}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Branch</span>
                    <span className="value">{selectedVendor.bankBranch || '—'}</span>
                  </div>
                  {(selectedVendor.panCard || selectedVendor.aadharCard || selectedVendor.bankDetailsDocument) && (
                    <>
                      <div className="detail full" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eef2f7' }}>
                        <span className="label" style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Documents</span>
                      </div>
                      {selectedVendor.panCard && (
                        <div className="detail full">
                          <span className="label">PAN Card</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                            {isPDFUrl(selectedVendor.panCard) ? (
                              <button onClick={() => downloadFile(selectedVendor.panCard, `PAN_Card_${selectedVendor.companyName || 'vendor'}.pdf`)} style={{ color: '#28a745', background: 'white', border: '1px solid #28a745', borderRadius: '4px', fontSize: '13px', padding: '6px 12px', cursor: 'pointer' }}>⬇️ Download</button>
                            ) : (
                              <>
                                <button onClick={() => downloadFile(selectedVendor.panCard, `PAN_Card_${selectedVendor.companyName || 'vendor'}.jpg`)} style={{ color: '#28a745', background: 'white', border: '1px solid #28a745', borderRadius: '4px', fontSize: '13px', padding: '6px 12px', cursor: 'pointer' }}>⬇️ Download</button>
                                <img src={selectedVendor.panCard} alt="PAN Card" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '4px', border: '1px solid #ddd', marginLeft: '8px' }} />
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      {selectedVendor.aadharCard && (
                        <div className="detail full">
                          <span className="label">Aadhar Card</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                            {isPDFUrl(selectedVendor.aadharCard) ? (
                              <button onClick={() => downloadFile(selectedVendor.aadharCard, `Aadhar_Card_${selectedVendor.companyName || 'vendor'}.pdf`)} style={{ color: '#28a745', background: 'white', border: '1px solid #28a745', borderRadius: '4px', fontSize: '13px', padding: '6px 12px', cursor: 'pointer' }}>⬇️ Download</button>
                            ) : (
                              <>
                                <button onClick={() => downloadFile(selectedVendor.aadharCard, `Aadhar_Card_${selectedVendor.companyName || 'vendor'}.jpg`)} style={{ color: '#28a745', background: 'white', border: '1px solid #28a745', borderRadius: '4px', fontSize: '13px', padding: '6px 12px', cursor: 'pointer' }}>⬇️ Download</button>
                                <img src={selectedVendor.aadharCard} alt="Aadhar Card" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '4px', border: '1px solid #ddd', marginLeft: '8px' }} />
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      {selectedVendor.bankDetailsDocument && (
                        <div className="detail full">
                          <span className="label">Bank Details Document</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                            {isPDFUrl(selectedVendor.bankDetailsDocument) ? (
                              <button onClick={() => downloadFile(selectedVendor.bankDetailsDocument, `Bank_Details_${selectedVendor.companyName || 'vendor'}.pdf`)} style={{ color: '#28a745', background: 'white', border: '1px solid #28a745', borderRadius: '4px', fontSize: '13px', padding: '6px 12px', cursor: 'pointer' }}>⬇️ Download</button>
                            ) : (
                              <>
                                <button onClick={() => downloadFile(selectedVendor.bankDetailsDocument, `Bank_Details_${selectedVendor.companyName || 'vendor'}.jpg`)} style={{ color: '#28a745', background: 'white', border: '1px solid #28a745', borderRadius: '4px', fontSize: '13px', padding: '6px 12px', cursor: 'pointer' }}>⬇️ Download</button>
                                <img src={selectedVendor.bankDetailsDocument} alt="Bank Details Document" style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '4px', border: '1px solid #ddd', marginLeft: '8px' }} />
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="stats-row">
                  <div className="mini-stat">
                    <span className="big">{selectedVendor.productsCount || 0}</span>
                    <span className="sub">Products</span>
                  </div>
                  <div className="mini-stat">
                    <span className="big">{selectedVendor.ordersCount || 0}</span>
                    <span className="sub">Orders</span>
                  </div>
                  <div className="mini-stat">
                    <span className="big">{selectedVendor.rating ? selectedVendor.rating.toFixed(1) : '—'}</span>
                    <span className="sub">Rating</span>
                  </div>
                  <div className="mini-stat">
                    <span className="big">{currencySymbol}{(selectedVendor.balance || 0).toLocaleString()}</span>
                    <span className="sub">Balance</span>
                  </div>
                  <div className="mini-stat">
                    <span className="big">{currencySymbol}{(selectedVendor.totalEarnings || 0).toLocaleString()}</span>
                    <span className="sub">Total Earnings</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;