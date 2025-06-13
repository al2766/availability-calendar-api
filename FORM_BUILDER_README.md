# Custom Form Builder System

This system transforms your hardcoded booking forms into a dynamic form builder that allows users to create custom booking forms with live pricing calculations.

## 🎯 What's New

### ✅ Form Builder Features
- **Dynamic Form Creation**: Build forms with drag-and-drop field types
- **Live Pricing Logic**: Set up complex pricing rules with real-time calculations  
- **Multiple Field Types**: Text, email, phone, dropdowns, checkboxes, address lookup, and more
- **Section Headers**: Organize forms with clear sections
- **Validation Rules**: Set required fields, min/max lengths, patterns
- **Preview Mode**: See exactly how your form will look to customers

### ✅ Pricing System
- **Base Pricing**: Set minimum prices and hourly rates
- **Field-Based Pricing**: Link form fields to price calculations
- **Conditional Rules**: Create "if this, then that" pricing logic
- **Time Calculations**: Automatic time estimates with 2-cleaner assignments
- **Live Updates**: Prices update as customers fill out the form

### ✅ Admin Interface
- **Forms Tab**: Manage all your custom forms
- **Template Creation**: Convert existing forms to templates
- **Form URLs**: Easy sharing with copy-to-clipboard
- **Form Stats**: See field counts and creation dates

## 🚀 How to Use

### 1. Access the Form Builder
1. Go to your admin dashboard
2. Click the **"Forms"** tab
3. Click **"+ Create New Form"**

### 2. Build Your Form
1. **Form Settings**: Give your form a name and description
2. **Add Fields**: Drag fields from the library to your form
3. **Configure Fields**: Set labels, validation, and pricing options
4. **Set Pricing**: Configure base prices and conditional rules
5. **Preview**: Test your form before publishing

### 3. Share Your Form
- Each form gets a unique URL: `/booking/custom/FORM_ID`
- Copy URLs from the Forms tab
- Forms work exactly like your existing booking system

## 📋 Field Types Available

### Basic Fields
- **Text Input**: Names, references, special instructions
- **Email**: Customer email addresses with validation
- **Phone**: Phone numbers with formatting
- **Text Area**: Longer descriptions and requirements
- **Number**: Quantities, counts, measurements

### Selection Fields
- **Dropdown**: Single choice from predefined options
- **Radio Group**: Single choice with visual options
- **Checkbox Group**: Multiple selections

### Special Fields
- **Address Lookup**: Integrated address search (uses your existing component)
- **Section Header**: Organize forms into clear sections

### Layout Fields
- **Section Headers**: Create organized form sections with descriptions

## ⚙️ Pricing Configuration

### Base Pricing
- **Base Price**: Starting price (e.g., £56 for minimum 2 hours)
- **Hourly Rate**: Rate for time-based calculations (e.g., £28/hour)

### Field Pricing
Each field can contribute to pricing:
- **Number Fields**: Price per unit (e.g., £14 per extra room)
- **Dropdowns**: Price modifiers (e.g., 1.2x for "quite dirty")
- **Checkboxes**: Fixed prices (e.g., £25 for oven cleaning)

### Pricing Rules
Create "if-then" rules:
- **Condition**: If field X equals/greater than/contains Y
- **Action**: Then add price/multiply price/add time

### Smart Features
- **Two-Cleaner Assignment**: Automatically assigns 2 cleaners for jobs over 4 hours
- **Time Reduction**: 2-cleaner jobs complete 43% faster (÷1.75)
- **Live Updates**: Prices update immediately as customers make selections

## 🔧 Template Creation

Convert your existing forms to editable templates:

1. Go to Forms tab
2. Click **"📋 Create Template Forms"**
3. This creates editable versions of Home and Office cleaning forms
4. Customize them as needed

## 🌐 URLs and Integration

### Form URLs
- Custom forms: `/booking/custom/FORM_ID`
- Home cleaning: `/booking/home` (unchanged)
- Office cleaning: `/booking/office` (unchanged)

### Backward Compatibility
- All existing bookings continue to work
- Original forms remain functional
- New forms integrate with existing booking system

## 📊 Form Management

### Forms Tab Features
- **Create**: Build new forms from scratch
- **Edit**: Modify existing forms
- **Preview**: Test forms before publishing  
- **Copy URLs**: Share forms easily
- **Delete**: Remove unused forms
- **Template Creation**: Convert existing forms

### Form Cards Show
- Form name and description
- Number of fields
- Creation and update dates
- Quick action buttons

## 🎨 Advanced Features

### Conditional Logic
Create smart forms that adapt:
```
IF cleanliness = "filthy" 
THEN multiply price by 2.0

IF total_rooms > 5 
THEN add £50 to price
```

### Multi-Step Pricing
Combine multiple pricing factors:
1. Base price (minimum service charge)
2. Field-based additions (rooms, services)
3. Conditional multipliers (difficulty, size)
4. Add-on services (extras)

### Validation Rules
Ensure data quality:
- Required fields
- Email format validation
- Phone number patterns
- Min/max lengths
- Custom regex patterns

## 🔍 Testing Your Forms

### Preview Mode
- Shows exactly how customers will see the form
- Test all field interactions
- Verify pricing calculations
- Check validation rules

### Live Testing
- Use the form URL to test end-to-end
- Complete actual bookings
- Verify data appears in admin dashboard

## 🛡️ Data Handling

### Form Submissions
- All custom forms integrate with existing booking system
- Data appears in Bookings tab
- Same email notifications and workflows
- Compatible with existing pricing logic

### Address Integration
- Uses your existing AddressLookup component
- Same postcode validation and formatting
- Maintains existing address handling

## 📈 Migration Path

### Phase 1: Current State ✅
- Two hardcoded forms (Home, Office)
- Fixed fields and pricing logic
- Manual code changes needed for updates

### Phase 2: Form Builder (New!) ✅
- Dynamic form creation
- Visual form builder interface
- Custom pricing rules
- Template system

### Phase 3: Future Enhancements
- Form analytics and conversion tracking
- A/B testing different form versions
- Customer form preferences
- Integration with marketing tools

## 🔧 Technical Implementation

### Database Structure
```
customForms/
├── formId/
│   ├── name: "Form Name"
│   ├── description: "Form description"
│   ├── fields: [...]
│   ├── pricingLogic: {...}
│   ├── settings: {...}
│   └── timestamps
```

### Field Configuration
```javascript
{
  id: "unique_field_id",
  type: "text|email|select|checkbox_group|...",
  name: "field_name",
  label: "Display Label",
  required: true|false,
  pricingEnabled: true|false,
  options: [...] // for select/checkbox fields
}
```

### Pricing Logic
```javascript
{
  basePrice: 56,
  hourlyRate: 28,
  rules: [
    {
      condition: { field: "rooms", operator: "greater_than", value: "3" },
      action: { type: "add_price", value: 50 }
    }
  ]
}
```

## 🎯 Best Practices

### Form Design
- Use clear, descriptive field labels
- Group related fields with section headers
- Keep forms as short as possible
- Test on mobile devices

### Pricing Logic
- Start with simple base pricing
- Add complexity gradually
- Test all pricing scenarios
- Document your pricing rules

### Field Naming
- Use descriptive names (e.g., "bedrooms" not "field1")
- Avoid spaces and special characters
- Keep names consistent across forms

## 🆘 Troubleshooting

### Common Issues
1. **Form not loading**: Check form ID in URL
2. **Pricing not calculating**: Verify pricing rules setup
3. **Fields not saving**: Check required field validation
4. **Address lookup not working**: Verify address field configuration

### Support
- Check browser console for error messages
- Verify Firebase permissions
- Test with simple forms first
- Use template forms as examples

## 🚀 Getting Started Checklist

1. ✅ Access Forms tab in admin dashboard
2. ✅ Click "Create Template Forms" to get started
3. ✅ Edit a template to see how it works
4. ✅ Create your first custom form
5. ✅ Test the form URL end-to-end
6. ✅ Share the form with customers

## 🎉 Success!

You now have a powerful form builder system that allows you to:
- Create unlimited custom booking forms
- Set up complex pricing logic
- Manage everything from one admin interface
- Maintain backward compatibility with existing forms

The system grows with your business - create different forms for different services, test pricing strategies, and adapt to customer needs without touching code.

**Next Steps**: Try creating a template form, then build your first custom form!
