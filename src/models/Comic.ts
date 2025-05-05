import { DataTypes, Model, CreationOptional, HasManyAddAssociationMixin, HasManyHasAssociationMixin, HasManyRemoveAssociationsMixin, HasManyGetAssociationsMixin } from "sequelize";
import { sequelize } from ".";
import Chapter from "./Chapter";

class Comic extends Model {
  declare id: CreationOptional<string>;
  declare title: string;
  declare slug: string;
  declare synopsis: string;
  declare author: string;
  declare status: "Ongoing" | "Completed";
  declare coverImage: string;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  
  declare addChapter: HasManyAddAssociationMixin<Chapter, number>
  declare hasChapter: HasManyHasAssociationMixin<Chapter, number>
  declare removeChapter: HasManyRemoveAssociationsMixin<Chapter,number>
  declare getChapters: HasManyGetAssociationsMixin<Chapter>
}

Comic.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
      unique: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    synopsis: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    author: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("Ongoing", "Completed"),
      defaultValue: "Ongoing",
    },
    coverImage: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Comic",
  }
);

export default Comic;
