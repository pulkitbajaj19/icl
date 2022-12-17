// import modules
const jwt = require('jsonwebtoken')
const bcryptjs = require('bcryptjs')

// import models
const User = require('../models/user')

// constants
const LOGIN_PERIOD_SEC = 36000

exports.getUser = async (req, res, next) => {
  if (!req.user) {
    return res.status(400).json({
      status: 'error',
      msg: 'user not set',
    })
  }
  User.findById(req.user.id)
    .then((user) => {
      if (!user) {
        return res.status(400).json({
          status: 'error',
          msg: 'User not found',
        })
      }
      // return user info
      return res.status(200).json({
        status: 'ok',
        msg: 'User fetched successfully',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    })
    .catch((err) => {
      next(err)
    })
}

exports.postLogin = (req, res, next) => {
  const { email, password } = req.body

  // check if user exists
  User.findOne({ email: email })
    .lean()
    .then((user) => {
      if (!user) {
        return res.status(400).json({
          msg: 'Invalid credentials',
        })
      }
      // if user exists Match password
      return bcryptjs.compare(password, user.password).then((isMatch) => {
        if (!isMatch) {
          return res.status(400).json({
            msg: 'Incorrect password',
          })
        }

        // return jwt token
        const payload = {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        }
        jwt.sign(
          payload,
          process.env.JWT_SECRET,
          { expiresIn: LOGIN_PERIOD_SEC },
          (err, token) => {
            if (err) {
              console.log('-----error-while-signing-jwt---', err)
              throw err
            }
            return res.status(200).json({ token })
          }
        )
      })
    })
    .catch((err) => {
      next(err)
    })
}

// exports.login = async (req, res, next) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({
//         errors: errors.array(),
//       });
//     }

//     // Check if user exists
//     const { email, password } = req.body;
//     let user = await User.findOne({ email: email });
//     if (!user) {
//       return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
//     }

//     // Match password
//     const matched = await bcrypt.compare(password, user.password);
//     if (!matched) {
//       return res.status(400).json({ errors: [{ msg: 'Invalid credentials' }] });
//     }

//     // Return jwt
//     const payload = {
//       user: {
//         id: user._id,
//         email: user.email,
//         username: user.username,
//       },
//     };
//     jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 36000 }, (err, token) => {
//       if (err) {
//         throw err;
//       }
//       res.status(200).json({ token });
//     });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ errors: [{ msg: 'Server error' }] });
//   }
// };
