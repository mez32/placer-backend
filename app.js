const fs = require('fs')
const path = require('path')

const express = require('express')
const mongoose = require('mongoose')

const placesRoutes = require('./routes/places-routes')
const userRoutes = require('./routes/users-routes')
const HttpError = require('./models/http-error')

const app = express()

app.use(express.json())

app.use('/uploads/images', express.static(path.join('uploads', 'images')))

app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Origin, X-Requested-With, Content-Type, Accept, Authorization'
	)
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE')
	next()
})

app.use('/api/places', placesRoutes)
app.use('/api/users', userRoutes)

app.use((req, res, next) => {
	const error = new HttpError('Could not find this route', 404)
	throw error
})

app.use((error, req, res, next) => {
	if (req.file) {
		fs.unlink(req.file.path, (err) => {
			console.log(err)
		})
	}
	if (res.headerSent) {
		return next(error)
	}
	res.status(error.code || 500).json({ msg: error.message || 'An unknown error occured' })
})

mongoose
	.connect(
		`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@placer.me9y0.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`,
		{ useNewUrlParser: true },
		{ useUnifiedTopology: true }
	)
	.then(() => {
		app.listen(process.env.PORT || 5001)
		console.log('Listening on PORT 5001')
	})
	.catch((err) => {
		console.log(err)
	})
