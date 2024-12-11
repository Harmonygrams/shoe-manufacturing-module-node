import express, { Router } from 'express'
import { addColor, getColor, getColors, updateColor, deleteColor } from './controllers';
const router : Router = express.Router(); 

router
    .post('/', addColor)
    .get('/', getColors)
    .get('/:id', getColor)
    .put('/:id', updateColor)
    .delete('/:id', deleteColor)

export { router as colorRouter }


