const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['Instructor', 'Staff', 'Admin'],
    required: true
  },
  faceDescriptor: {
    type: [Number],
    required: false
  },
  username: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

userSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
