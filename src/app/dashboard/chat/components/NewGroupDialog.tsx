
'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, Chat } from '@/lib/types';
import type { User } from 'firebase/auth';

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User | null;
  allUsers: UserProfile[];
  onGroupCreated: (chat: Chat) => void;
}

export function NewGroupDialog({
  open,
  onOpenChange,
  currentUser,
  allUsers,
  onGroupCreated,
}: NewGroupDialogProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const handleUserSelect = (userId: string) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUserIds.size === 0 || !firestore || !currentUser) {
      toast({
        title: 'Invalid Input',
        description: 'Please provide a group name and select at least one member.',
        variant: 'destructive',
      });
      return;
    }

    const participantIds = [currentUser.uid, ...Array.from(selectedUserIds)];
    
    const chatData = {
      name: groupName,
      participantIds,
      createdBy: currentUser.uid,
      lastUpdated: serverTimestamp(),
      lastMessage: 'Group created',
    };

    try {
      const docRef = await addDoc(collection(firestore, 'chats'), chatData);
      
      const newChat: Chat = {
          ...chatData,
          id: docRef.id,
      };

      toast({
        title: 'Group Created!',
        description: `"${groupName}" has been created.`,
      });
      onGroupCreated(newChat);
      onOpenChange(false);
      setGroupName('');
      setSelectedUserIds(new Set());
    } catch (error: any) {
      toast({
        title: 'Error creating group',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a New Group Chat</DialogTitle>
          <DialogDescription>
            Select members and give your group a name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Weekend Riders"
            />
          </div>
          <div className="space-y-2">
            <Label>Members</Label>
            <ScrollArea className="h-[200px] w-full rounded-md border p-2">
              <div className="space-y-2">
                {allUsers
                  .filter((user) => user.id !== currentUser?.uid)
                  .map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center space-x-3 rounded-md p-2 hover:bg-muted"
                      onClick={() => handleUserSelect(user.id)}
                    >
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUserIds.has(user.id)}
                        onCheckedChange={() => handleUserSelect(user.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profilePicture} />
                        <AvatarFallback>{user.firstName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <label
                        htmlFor={`user-${user.id}`}
                        className="flex-1 cursor-pointer text-sm font-medium leading-none"
                      >
                        {user.firstName} {user.lastName}
                      </label>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreateGroup}>Create Group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    