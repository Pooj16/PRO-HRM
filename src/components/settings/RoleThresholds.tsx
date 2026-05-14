
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { Settings, Edit, Plus } from 'lucide-react';

const RoleThresholds = () => {
  const { roleThresholds } = useRealtimeData();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Role-Based Thresholds</CardTitle>
              <CardDescription>
                Configure minimum score requirements for different roles
              </CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Min ATS Score</TableHead>
                  <TableHead>Max ATS Score</TableHead>
                  <TableHead>Min Assessment Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleThresholds.map((threshold) => (
                  <TableRow key={threshold.id}>
                    <TableCell>
                      <div className="font-medium">{threshold.role_name}</div>
                    </TableCell>
                    <TableCell>{threshold.min_ats_score}</TableCell>
                    <TableCell>{threshold.max_ats_score}</TableCell>
                    <TableCell>{threshold.min_assessment_score}</TableCell>
                    <TableCell>
                      <Badge className={threshold.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {threshold.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {roleThresholds.length === 0 && (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No role thresholds configured yet.</p>
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Role Threshold
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Settings */}
      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>
            Configure global system preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Auto-Reject Threshold</CardTitle>
                <CardDescription className="text-sm">
                  Automatically reject candidates below this score
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">30</div>
                <Button variant="outline" size="sm" className="mt-2">
                  Configure
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Auto-Advance Threshold</CardTitle>
                <CardDescription className="text-sm">
                  Automatically advance candidates above this score
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">85</div>
                <Button variant="outline" size="sm" className="mt-2">
                  Configure
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleThresholds;
