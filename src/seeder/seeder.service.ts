import { Injectable, OnModuleInit } from "@nestjs/common";
import { OrmService } from "src/orm/orm.service";

interface IUser {
  id?: number;
  email: string;
  name: string;
  department: string
}

@Injectable()
export class SeederService implements OnModuleInit {
  constructor(private readonly prismaService: OrmService){}

  async onModuleInit() {
    const users: IUser[] = [{
        name: "Olvadis",
        email: "olvadis2004@gmail.com",
        department: "IT"
      },
      {
        name: "Monica",
        email: "olvadishernandezledesma@gmail.com",
        department: "Marketing"
      },
    ]

    try {
      const existRows = await this.prismaService.user.count();
      if(!existRows){
        await this.prismaService.user.createMany({data: users})
      }
    } catch (error) {
      console.warn("Error al guardar usuarios", error)
    }

  }
}