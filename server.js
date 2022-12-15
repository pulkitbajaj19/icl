require('dotenv').config()
// import modules
const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const multer = require('multer')
const fs = require('fs')
const path = require('path')

// import files
const entityRoutes = require('./routes/entities')
const auctionRoutes = require('./routes/auction')
const adminRoutes = require('./routes/admin')
const authRoutes = require('./routes/auth')
const authMiddleware = require('./middlewares/auth')

// initialize objects
const app = express()
const multerStorage = multer.diskStorage({
  filename: (req, file, cb) => {
    cb(
      null,
      new Date().getTime() +
        '-' +
        file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase()
    )
  },
  destination: (req, file, cb) => {
    fs.mkdirSync('static/images', { recursive: true })
    cb(null, './static/images')
  },
})
const multerMiddleware = multer({
  storage: multerStorage,
  limits: {
    fileSize: (process.env.MAX_IMAGE_SIZE_IN_MB || 4) * 1024 * 1024,
  },
}).single('image')

// handling cors policy
app.use('/', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

// middlewares
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use((req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err) {
      console.log('Error while storing files using multer storage!\n', err)
      req.multerError = err
      return res.json({
        status: 'error',
        msg: 'Error while storing file using multer',
        err: err,
      })
    }
    next()
  })
})
app.use(authMiddleware.setAuth)

// serve static files
app.use('/static', express.static(path.join(__dirname, 'static')))

// serve routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/auction', auctionRoutes)
app.use('/api/v1', entityRoutes)

// handling errors
app.use((err, req, res, next) => {
  return res.status(500).json({
    status: 'error',
    msg: err.message,
  })
})

const PORT = process.env.PORT || 8000
// connect mongoose client then listen to PORT
mongoose.set('strictQuery', true)
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((result) => {
    console.log('mongoose client Connected!')
    app.listen(PORT, () => {
      console.log(`server listening to port: ${PORT}`)
    })
  })
  .catch((err) => {
    console.log('client_not_connected', err)
  })
