const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
	general: {
		siteName: { type: String, default: '' },
		siteDescription: { type: String, default: '' },
		contactEmail: { type: String, default: '' },
		contactPhone: { type: String, default: '' },
		address: { type: String, default: '' },
		minAppVersion: { type: String, default: '' }
	},
	localization: {
		dateFormat: { type: String, default: 'MM/DD/YYYY' },
		timeFormat: { type: String, default: '12' },
		currency: { type: String, default: 'INR' },
		currencySymbol: { type: String, default: '₹' },
		decimalPlaces: { type: Number, default: 2 }
	},
	shipping: {
		freeShippingThreshold: { type: Number, default: 100 },
		defaultShippingCost: { type: Number, default: 10 },
		flatShippingFee: { type: Number, default: 0 }
	},
	tax: {
		rate: { type: Number, default: 0 }
	}
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);