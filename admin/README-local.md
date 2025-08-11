# MultiVendor Ecommerce Admin Panel

A comprehensive React-based admin panel for managing a multi-vendor ecommerce platform. This admin panel provides complete control over vendors, products, orders, customers, and all aspects of the ecommerce business.

## Features

### 🔐 Authentication
- Secure login system with email/password
- Forgot password functionality
- Role-based access control (Admin & Vendor Owner)
- Session management

### 📊 Dashboard
- Real-time statistics (sales, orders, vendors, customers)
- Interactive sales charts (daily, weekly, monthly)
- Recent orders overview
- Top selling products
- Pending approvals (vendors/products/withdrawals)

### 👥 User Management
- **Customers**: List, search, filter, view details, order history, enable/disable
- **Admin Users**: Add, edit, delete, role assignment, permissions management

### 🏪 Vendor Management
- Vendor listing with filters (approved, pending, blocked)
- Approve/reject vendor applications
- View vendor profiles and documents
- Commission settings
- Wallet/balance overview
- Enable/disable vendors

### 📦 Product Management
- Complete product CRUD operations
- Category management with hierarchy
- Brand management
- Product variants with pricing
- Image and video uploads
- SEO settings
- Stock management
- Product approval workflow

### 🛒 Order Management
- Order listing with filters
- Order status updates
- Order details and invoice generation
- Delivery partner assignment
- Refund and return management

### 💰 Payments & Transactions
- Admin earnings tracking
- Vendor payout management
- Withdrawal request approval
- Payment gateway integration

### 🎁 Marketing & Offers
- Coupon management
- Discount management
- Banner and slider management
- Flash sales

### ⭐ Reviews & Ratings
- Customer review moderation
- Rating management
- Flagged review handling

### ⚙️ Settings
- General site settings
- Vendor system configuration
- Shipping and tax settings
- Email and SMS configuration

## Demo Credentials

### Admin User
- **Email**: admin@example.com
- **Password**: admin123

### Vendor Owner
- **Email**: vendor@example.com
- **Password**: vendor123

## Installation & Setup

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ecommerce-admin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Dashboard components
│   ├── layout/         # Layout and navigation
│   ├── users/          # User management
│   ├── vendors/        # Vendor management
│   ├── products/       # Product management
│   ├── orders/         # Order management
│   ├── inventory/      # Inventory management
│   ├── payments/       # Payment management
│   ├── marketing/      # Marketing tools
│   ├── reviews/        # Review management
│   └── settings/       # Settings components
├── App.js              # Main application component
├── App.css             # Global styles
└── index.js            # Application entry point
```

## Data Structure

The application uses a comprehensive JSON data structure located in `public/data.json` that includes:

- **Users**: Admin users and customers
- **Vendors**: Vendor information and status
- **Products**: Product details with variants
- **Categories**: Hierarchical category structure
- **Brands**: Brand information
- **Orders**: Order details and status
- **Reviews**: Customer reviews and ratings
- **Coupons**: Discount codes and offers
- **Banners**: Marketing banners
- **Settings**: Application configuration

## Key Technologies

- **React 18**: Modern React with hooks
- **React Router**: Client-side routing
- **React Hook Form**: Form management and validation
- **Chart.js**: Interactive charts and graphs
- **React Hot Toast**: Toast notifications
- **CSS3**: Modern styling with responsive design

## Features in Detail

### Form Validation
All forms include comprehensive validation:
- Required field validation
- Email format validation
- Password strength requirements
- File upload validation
- Custom business logic validation

### Responsive Design
- Mobile-first approach
- Responsive tables and forms
- Touch-friendly interface
- Optimized for all screen sizes

### Search & Filtering
- Real-time search functionality
- Advanced filtering options
- Pagination for large datasets
- Sortable columns

### Modal System
- Reusable modal components
- Form modals for CRUD operations
- Confirmation dialogs
- Responsive modal design

## API Integration

The current version uses static JSON data. To integrate with a real API:

1. Replace `fetch('/data.json')` calls with actual API endpoints
2. Implement proper error handling for API calls
3. Add authentication headers
4. Handle loading states and error states
5. Implement real-time updates if needed

## Customization

### Styling
- Modify `src/App.css` for global styles
- Component-specific styles in respective CSS files
- Easy color scheme customization
- Responsive breakpoints can be adjusted

### Functionality
- Add new features by creating new components
- Extend existing components with additional functionality
- Modify validation rules in form components
- Add new data fields to the JSON structure

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.

---

**Note**: This is a demo application with static data. For production use, integrate with a backend API and implement proper security measures. 