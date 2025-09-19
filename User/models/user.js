const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long'],
        maxlength: [30, 'Username cannot exceed 30 characters']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        trim: true,
        validate: {
            validator: function(v) {
                // Basic phone number validation (10 digits)
                return /^\d{10}$/.test(v);
            },
            message: 'Phone number must be exactly 10 digits'
        }
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: 'Please enter a valid email address'
        }
    },

    // Added for Google OAuth users
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },

    // mark whether email/OTP verified
    isVerified: {
        type: Boolean,
        default: false
    },

    address: {
        type: String,
        trim: true,
        maxlength: [200, 'Address cannot exceed 200 characters']
    },
    age: {
        type: Number,
        min: [1, 'Age must be at least 1'],
        max: [120, 'Age cannot exceed 120']
    },
    sex: {
        type: String,
        enum: ['male', 'female', 'other'],
        lowercase: true
    },
    avatarUrl: {
        type: String,
        trim: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Pre-save middleware to hash password before saving
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        // Generate salt with cost factor of 12
        const salt = await bcrypt.genSalt(12);
        // Hash the password with the salt
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to get user's public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
    const userObject = this.toObject();
    delete userObject.password;
    return userObject;
};

// Instance method to compare password for authentication
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Static method to find user by email or username
userSchema.statics.findByEmailOrUsername = function(identifier) {
    return this.findOne({
        $or: [
            { email: identifier },
            { username: identifier }
        ]
    });
};

module.exports = mongoose.model('User', userSchema);
