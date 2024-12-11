import express from 'express'
import { addUnit, getUnit, getUnits, updateUnit, deleteUnit } from './controller'

const router = express.Router()

// Routes
router
    .post('/', addUnit)
    .get('/', getUnits)
    .get('/:id', getUnit)
    .put('/:id', updateUnit)
    .delete('/:id', deleteUnit)

export { router as unitRouter };