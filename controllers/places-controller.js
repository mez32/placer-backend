const fs = require('fs')

const { validationResult } = require('express-validator')
const mongoose = require('mongoose')

const HttpError = require('../models/http-error')
const getCoordsForAddress = require('../util/location')
const Place = require('../models/place')
const User = require('../models/user')

// GET - Get place by id
const getPlaceById = async (req, res, next) => {
	const placeId = req.params.pid

	let place
	try {
		place = await Place.findById(placeId)
	} catch (error) {
		return next(new HttpError('Something went wrong, please try again', 500))
	}

	if (!place) {
		return next(new HttpError('Could not find a place for the provided id', 404))
	}

	res.json({ place: place.toObject({ getters: true }) })
}

// GET - Get places by user id
const getPlacesbyUserId = async (req, res, next) => {
	const userId = req.params.uid

	let places
	try {
		places = await Place.find({ creator: userId })
	} catch (error) {
		return next(new HttpError('Something went wrong, please try again', 500))
	}

	if (!places || places.length === 0) {
		return next(new HttpError('Could not find places for the provided user id', 404))
	}

	res.json({ places: places.map((p) => p.toObject({ getters: true })) })
}

// POST - Create new place
const createPlace = async (req, res, next) => {
	const errors = validationResult(req)
	if (!errors.isEmpty()) {
		return next(new HttpError('Invalid inputs passed, please check your data', 422))
	}

	const { title, description, address } = req.body

	let coordinates
	try {
		coordinates = await getCoordsForAddress(address)
	} catch (error) {
		return next(error)
	}

	const createdPlace = new Place({
		title,
		description,
		address,
		location: coordinates,
		image: req.file.path,
		creator: req.userData.userId,
	})

	let user
	try {
		user = await User.findById(req.userData.userId)
	} catch (err) {
		return next(new HttpError('Creating place failed, try agian later', 500))
	}

	if (!user) {
		return next(new HttpError('Could not find user for provided id', 404))
	}

	try {
		const sess = await mongoose.startSession()
		sess.startTransaction()
		await createdPlace.save({ session: sess })
		user.places.push(createdPlace)
		await user.save({ session: sess })
		await sess.commitTransaction()
	} catch (err) {
		console.log(err)
		const error = new HttpError('Creating place failed, please try again', 500)
		return next(error)
	}

	res.status(201).json({ place: createdPlace })
}
// PATCH - update a place by id
const updatPlaceById = async (req, res, next) => {
	const errors = validationResult(req)
	if (!errors.isEmpty()) {
		return next(new HttpError('Invalid inputs passed, please check your data', 422))
	}

	const { title, description } = req.body
	const placeId = req.params.pid

	let place
	try {
		place = await Place.findById(placeId)
	} catch (error) {
		return next(new HttpError('Something went wrong, please try again', 500))
	}

	if (place.creator.toString() !== req.userData.userId) {
		return next(new HttpError('You are not allowed to edit this place', 401))
	}

	place.title = title
	place.description = description

	try {
		await place.save()
	} catch (error) {
		return next(new HttpError('Something went wrong, please try again', 500))
	}

	res.status(200).json({ place: place.toObject({ getters: true }) })
}

// DELETE - delete place by id
const deletePlaceById = async (req, res, next) => {
	const placeId = req.params.pid

	let place
	try {
		place = await Place.findById(placeId).populate('creator')
	} catch (err) {
		return next(new HttpError('Something went wrong, could not delete place', 500))
	}

	if (!place) {
		return next(new HttpError('Could not find a place by that id', 404))
	}

	if (place.creator.id !== req.userData.userId) {
		return next(new HttpError('You are not allowed to delete this place', 401))
	}

	const imagePath = place.image

	try {
		const sess = await mongoose.startSession()
		sess.startTransaction()
		await place.remove({ session: sess })
		place.creator.places.pull(place)
		await place.creator.save({ session: sess })
		await sess.commitTransaction()
	} catch (err) {
		return next(new HttpError('Something went wrong, could not delete place', 500))
	}

	fs.unlink(imagePath, (err) => {
		console.log(err)
	})

	res.status(200).json({ msg: 'Place deleted' })
}

exports.getPlaceById = getPlaceById
exports.getPlacesbyUserId = getPlacesbyUserId
exports.createPlace = createPlace
exports.deletePlaceById = deletePlaceById
exports.updatPlaceById = updatPlaceById
