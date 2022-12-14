require('dotenv').config()
// import modules
const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')

// import files
const entityRoutes = require('./routes/entities')
const auctionRoutes = require('./routes/auction')
const adminRoutes = require('./routes/admin')
const authRoutes = require('./routes/auth')
const authMiddleware = require('./middlewares/auth')

// initialize objects
const app = express()

// middlewares
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
// handling cors policy
// app.use('/', (req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '*')
//   res.header('Access-Control-Allow-Headers', '*')
//   next()
// })

// routes
app.use(authMiddleware.setAuth)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/auction', auctionRoutes)
app.use('/api/v1', entityRoutes)

const PORT = process.env.PORT || 3000
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
