import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BetaNotification() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <Card className="border-l-4 border-yellow-500 bg-yellow-100 mt-8 shadow-md">
      <CardContent className="flex items-start gap-3 p-4">
        <AlertTriangle className="text-yellow-600 " size={24} />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-yellow-800 ">
            Multi-Person Feature in Beta
          </h4>
          <p className="text-sm text-yellow-700 ">
            AI-generated results may vary, and occasional inaccuracies may occur. We are working on improving accuracy.
            If you encounter any issues, please share your feedback.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-yellow-700"
          onClick={() => setVisible(false)}
        >
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
}
