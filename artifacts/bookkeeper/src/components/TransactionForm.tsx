import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import type { Transaction } from "@workspace/api-client-react";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  type: z.enum(["income", "expense", "transfer"]),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  taxDeductible: z.boolean().default(false),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  initialData?: Transaction;
  onSuccess: () => void;
}

export function TransactionForm({ initialData, onSuccess }: Props) {
  const createMut = useCreateTransaction();
  const updateMut = useUpdateTransaction();
  const isPending = createMut.isPending || updateMut.isPending;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ? {
      date: initialData.date.split("T")[0],
      description: initialData.description,
      amount: initialData.amount,
      type: initialData.type,
      category: initialData.category,
      subcategory: initialData.subcategory || undefined,
      taxDeductible: initialData.taxDeductible,
      notes: initialData.notes || undefined,
    } : {
      date: new Date().toISOString().split("T")[0],
      type: "expense",
      taxDeductible: false,
    }
  });

  const type = watch("type");

  const onSubmit = async (data: FormData) => {
    if (initialData) {
      await updateMut.mutateAsync({ id: initialData.id, data });
    } else {
      await createMut.mutateAsync({ data });
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" {...register("date")} />
          {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v: any) => setValue("type", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input placeholder="E.g. Adobe Software Subscription" {...register("description")} />
        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input type="number" step="0.01" placeholder="0.00" {...register("amount")} />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Input placeholder="E.g. Software" {...register("category")} />
          {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
        </div>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Checkbox 
          id="taxDeductible" 
          checked={watch("taxDeductible")} 
          onCheckedChange={(checked) => setValue("taxDeductible", checked as boolean)} 
        />
        <Label htmlFor="taxDeductible">Mark as Tax Deductible</Label>
      </div>

      <div className="space-y-2">
        <Label>Notes (Optional)</Label>
        <Textarea placeholder="Additional details..." {...register("notes")} />
      </div>

      <div className="pt-4 flex justify-end">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? "Saving..." : initialData ? "Update Transaction" : "Save Transaction"}
        </Button>
      </div>
    </form>
  );
}
