import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Flight } from 'src/schemas/flight.schema';
import { CreateFlightDto } from './dto/createFlightDto';
import { UpdateFlightDto } from './dto/updateFlightDto';
import { BrokerService } from 'src/broker/broker.service';
import { Channels } from 'src/util/enums';

@Injectable()
export class FlightService implements OnModuleInit{
    constructor(
        @InjectModel(Flight.name)
        private flightModel: Model<Flight>,
        private brokerService: BrokerService
    ){}

    static brokerService = new BrokerService()

    async create(obj: CreateFlightDto){
        const existingName = await this.getByName(obj.name)
        if(existingName)throw new HttpException(`flight "${existingName.name}" already exists.`, HttpStatus.BAD_REQUEST)
        //create and cache before return
        const flight = await this.flightModel.create({...obj})
        return flight
    }

    async updateFlight(id: string, obj: UpdateFlightDto){
        const target = await this.flightModel.findById(id)
        if(!target)throw new HttpException("flight not found", HttpStatus.NOT_FOUND)
        if(obj.name){
            const existingName = await this.getByName(obj.name)
            if(existingName)throw new HttpException(`flight "${existingName.name}" already exists.`, HttpStatus.BAD_REQUEST)
        }
        const updated = await this.flightModel.findByIdAndUpdate(id, {...obj}, {new: true})
        //cache updated flight
        return updated
    }

    query(q: object){
        return this.flightModel.find({...q})
    }

    getById(id: string){
        //check if exist 
        return this.flightModel.findById(id)
    }

    getByName(name: string){
        return this.flightModel.findOne({name})
    }


    deleteFlight(id: string){
        return this.flightModel.findByIdAndDelete(id)
    }

    async onModuleInit() {
        this.brokerService.watch(Channels.NEWBOOKING, async(d: {flightId: string, email: string, userId: string})=>{
            const {flightId: id, email, userId} = d
            if(!id)return
            const target = await this.flightModel.findById(id)
            if(!target){
                return this.brokerService.sendToQueue(Channels.NEWBOOKINGCALLBACK, {flight: null, email, userId})
            }else{
            target.passengers += 1
            await target.save()
                return this.brokerService.sendToQueue(Channels.NEWBOOKINGCALLBACK, {flight: target, email, userId})
            }
        })
    }

    


}
