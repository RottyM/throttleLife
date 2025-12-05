
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { UserProfile } from "@/lib/types";

interface ProfileViewProps {
    profile: UserProfile;
}

export const ProfileView = ({ profile }: ProfileViewProps) => {
    const hasClubInfo = profile.clubName || profile.clubChapter || profile.rank;

    return (
        <Card>
            <CardContent className="p-8">
                {profile.aboutMe && (
                     <div>
                        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            About Me
                        </h3>
                        <p className="text-foreground/90">{profile.aboutMe}</p>
                        <Separator className="my-8" />
                    </div>
                )}
               
                <div className="grid grid-cols-1 gap-y-8 gap-x-6 sm:grid-cols-2">
                    <div>
                        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Contact
                        </h3>
                        <div className="space-y-2">
                             <p>
                                <span className="font-semibold text-foreground/90">Email:</span>{' '}
                                <a href={`mailto:${profile.email}`} className="text-muted-foreground hover:underline">
                                    {profile.email}
                                </a>
                            </p>
                            <p>
                                <span className="font-semibold text-foreground/90">Phone:</span>{' '}
                                {profile.contactInfo ? (
                                    <a href={`tel:${profile.contactInfo}`} className="text-muted-foreground hover:underline">
                                        {profile.contactInfo}
                                    </a>
                                ) : (
                                    <span className="text-muted-foreground">Not provided</span>
                                )}
                            </p>
                            <p>
                                <span className="font-semibold text-foreground/90">Emergency:</span>{' '}
                                 {profile.emergencyContact ? (
                                    <a href={`tel:${profile.emergencyContact}`} className="text-muted-foreground hover:underline">
                                        {profile.emergencyContact}
                                    </a>
                                ) : (
                                    <span className="text-muted-foreground">Not provided</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
