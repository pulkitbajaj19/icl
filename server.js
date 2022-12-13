require('dotenv').config()
// import modules
const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')

// import files
const entityRoutes = require('./routes/entities')
const auctionRoutes = require('./routes/auction')
const adminroutes = require('./routes/admin')

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
app.use('/api/v1/admin', adminroutes)
app.use('/api/v1/auction', auctionRoutes)
app.use('/api/v1', entityRoutes)

const PORT = process.env.PORT || 3000
// connect mongoose then listen to PORT
mongoose
  .connect(process.env.MONGODB_URI)
  .then((result) => {
    console.log('mongoose client Connected!')
    app.listen(PORT, () => {
      console.log(`listening to port ${PORT}`)
    })
  })
  .catch((err) => {
    console.log('client_not_connected', err)
  })
