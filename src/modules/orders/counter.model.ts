import mongoose, { Schema, Model } from 'mongoose';

export interface ICounter {
  _id: string;
  seq: number;
}

export interface ICounterModel extends Model<ICounter> {
  getNextSequence(name: string, startingSeq?: number): Promise<number>;
}

const counterSchema = new Schema<ICounter, ICounterModel>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 1000 },
});

counterSchema.statics.getNextSequence = async function (name: string, startingSeq = 1000): Promise<number> {
  const result: any = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (result.seq < startingSeq) {
    result.seq = startingSeq;
    await result.save();
  }
  return result.seq;
};

export const Counter =
  (mongoose.models.Counter as unknown as ICounterModel) ||
  (mongoose.model<ICounter, ICounterModel>('Counter', counterSchema) as unknown as ICounterModel);

export default Counter;
