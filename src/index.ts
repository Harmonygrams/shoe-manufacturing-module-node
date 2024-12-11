import express from 'express';
import { indexRoutersV1 } from './routes';
import cors from 'cors'; 

const app = express()
app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended : true }))

app.use('/api/v1', indexRoutersV1)

app.listen(5001, () => {
    console.log('Server Urls \nv1: http://localhost:5001/api/v1');
})
