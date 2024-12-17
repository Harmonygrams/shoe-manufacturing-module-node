import express, { Router } from 'express';
import { addProduction, getProductions, } from './controllers';

const router : Router = express.Router(); 

router
    .post('/', addProduction)
    .get('/', getProductions)

export { router as productionRouter }